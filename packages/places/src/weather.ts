// Metric weather for a place: Open-Meteo first, MET Norway Locationforecast as the fallback.
// Times are written in the place's own zone. Results are cached in memory per ~1 km cell for
// 15 minutes, or until MET's Expires time, which both services' rules ask for. When both fail
// the answer is null and one warning is logged, so the UI can say "weather unavailable".

import type { Condition, WeatherDto } from '@fotoai/contracts';
import { timezoneAt, toZonedIso } from '@fotoai/core';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface WeatherService {
  get(lat: number, lng: number): Promise<WeatherDto | null>;
}

const CACHE_MS = 15 * 60_000;
const CACHE_MAX = 500;
const TIMEOUT_MS = 10_000;
export const MET_USER_AGENT = 'FotoAI-Coach/2 (+https://myfoto.topues.com)';

/** Open-Meteo WMO weather codes. */
export function conditionFromWmo(code: number): Condition {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2) return 'partly_cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'thunder';
  return 'unknown';
}

/** MET Norway symbol codes, such as `partlycloudy_day` or `heavyrainandthunder`. */
export function conditionFromMet(symbol: string): Condition {
  const s = symbol.replace(/_(day|night|polartwilight)$/, '');
  if (s.includes('thunder')) return 'thunder';
  if (s.includes('snow') || s.includes('sleet')) return 'snow';
  if (s.includes('rain')) return 'rain';
  if (s === 'fog') return 'fog';
  if (s === 'clearsky') return 'clear';
  if (s === 'fair' || s === 'partlycloudy') return 'partly_cloudy';
  if (s === 'cloudy') return 'cloudy';
  return 'unknown';
}

class SourceError extends Error {}

const round = (value: number, places: number) => Number(value.toFixed(places));
const num = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new SourceError('bad body');
  return value;
};
const numOrNull = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const pct = (value: unknown) => Math.min(100, Math.max(0, num(value)));

async function getJson(fetch: FetchLike, url: string, init: RequestInit = {}): Promise<{ body: unknown; headers: Headers }> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new SourceError(`status ${response.status}`);
  try {
    return { body: await response.json(), headers: response.headers };
  } catch {
    throw new SourceError('bad body');
  }
}

type Fetched = { weather: Omit<WeatherDto, 'fetchedAt'>; expiresAt?: number };

async function fromOpenMeteo(fetch: FetchLike, lat: number, lng: number, zone: string, now: Date): Promise<Fetched> {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${round(lat, 4)}&longitude=${round(lng, 4)}` +
    '&current=temperature_2m,relative_humidity_2m,precipitation,cloud_cover,wind_speed_10m,weather_code' +
    '&hourly=temperature_2m,precipitation,cloud_cover,weather_code' +
    '&forecast_days=2&timeformat=unixtime&timezone=GMT';
  let result: { body: unknown };
  try {
    result = await getJson(fetch, url);
  } catch (err) {
    if (err instanceof SourceError) throw err;
    result = await getJson(fetch, url); // one retry on a timeout or network error (the live app's rule)
  }
  const body = result.body as {
    current?: Record<string, unknown>;
    hourly?: { time?: unknown[]; temperature_2m?: unknown[]; precipitation?: unknown[]; cloud_cover?: unknown[]; weather_code?: unknown[] };
  };
  const c = body.current;
  const h = body.hourly;
  if (!c || !h || !Array.isArray(h.time)) throw new SourceError('bad body');
  const at = (seconds: unknown) => toZonedIso(new Date(num(seconds) * 1000), zone);
  const hourStart = Math.floor(now.getTime() / 3_600_000) * 3600;
  const hourly = h.time
    .map((t, i) => ({ t: num(t), i }))
    .filter(({ t }) => t >= hourStart)
    .slice(0, 24)
    .map(({ t, i }) => ({
      time: at(t),
      temperatureC: num(h.temperature_2m?.[i]),
      cloudPct: pct(h.cloud_cover?.[i]),
      precipitationMm: numOrNull(h.precipitation?.[i]),
      condition: conditionFromWmo(num(h.weather_code?.[i])),
    }));
  return {
    weather: {
      source: 'open-meteo',
      attribution: 'Weather data by Open-Meteo.com (CC BY 4.0)',
      timezone: zone,
      current: {
        time: at(c.time),
        temperatureC: num(c.temperature_2m),
        windKph: num(c.wind_speed_10m),
        cloudPct: pct(c.cloud_cover),
        precipitationMm: numOrNull(c.precipitation),
        humidityPct: numOrNull(c.relative_humidity_2m),
        condition: conditionFromWmo(num(c.weather_code)),
      },
      hourly,
    },
  };
}

type MetEntry = {
  time?: unknown;
  data?: {
    instant?: { details?: Record<string, unknown> };
    next_1_hours?: { summary?: { symbol_code?: unknown }; details?: { precipitation_amount?: unknown } };
  };
};

async function fromMetNorway(fetch: FetchLike, lat: number, lng: number, zone: string): Promise<Fetched> {
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${round(lat, 4)}&lon=${round(lng, 4)}`;
  const { body, headers } = await getJson(fetch, url, { headers: { 'user-agent': MET_USER_AGENT } });
  const series = (body as { properties?: { timeseries?: MetEntry[] } }).properties?.timeseries;
  if (!Array.isArray(series) || series.length === 0) throw new SourceError('bad body');
  const reading = (entry: MetEntry) => {
    const d = entry.data?.instant?.details ?? {};
    const next = entry.data?.next_1_hours;
    const symbol = next?.summary?.symbol_code;
    return {
      time: toZonedIso(new Date(String(entry.time)), zone),
      temperatureC: num(d.air_temperature),
      cloudPct: pct(d.cloud_area_fraction),
      precipitationMm: numOrNull(next?.details?.precipitation_amount),
      condition: typeof symbol === 'string' ? conditionFromMet(symbol) : ('unknown' as const),
    };
  };
  const first = series[0]!;
  const details = first.data?.instant?.details ?? {};
  const expires = Date.parse(headers.get('expires') ?? '');
  return {
    weather: {
      source: 'met-norway',
      attribution: 'Weather data from MET Norway (CC BY 4.0)',
      timezone: zone,
      current: {
        ...reading(first),
        windKph: round(num(details.wind_speed) * 3.6, 1),
        humidityPct: numOrNull(details.relative_humidity),
      },
      hourly: series.filter((e) => e.data?.next_1_hours).slice(0, 24).map(reading),
    },
    expiresAt: Number.isFinite(expires) ? expires : undefined,
  };
}

const reason = (err: unknown) => (err instanceof SourceError ? err.message : 'network error');

export function createWeatherService(opts: { fetch: FetchLike; now?: () => Date; log?: { warn(message: string): void } }): WeatherService {
  const now = opts.now ?? (() => new Date());
  const log = opts.log ?? { warn: (message: string) => console.warn(message) };
  const cache = new Map<string, { value: WeatherDto; expiresAt: number }>();

  return {
    async get(lat, lng) {
      const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
      const at = now();
      const hit = cache.get(key);
      if (hit && hit.expiresAt > at.getTime()) return hit.value;
      cache.delete(key);

      const zone = timezoneAt(lat, lng);
      let fetched: Fetched;
      try {
        fetched = await fromOpenMeteo(opts.fetch, lat, lng, zone, at);
      } catch (first) {
        try {
          fetched = await fromMetNorway(opts.fetch, lat, lng, zone);
        } catch (second) {
          log.warn(`weather unavailable near ${key}: open-meteo ${reason(first)}; met-norway ${reason(second)}`);
          return null;
        }
      }

      const value: WeatherDto = { ...fetched.weather, fetchedAt: toZonedIso(at, zone) };
      const expiresAt = fetched.expiresAt && fetched.expiresAt > at.getTime() ? fetched.expiresAt : at.getTime() + CACHE_MS;
      cache.set(key, { value, expiresAt });
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
      return value;
    },
  };
}
