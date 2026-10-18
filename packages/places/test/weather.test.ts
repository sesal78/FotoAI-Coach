import { readFileSync } from 'node:fs';

import { WeatherDto } from '@fotoai/contracts';
import { expect, test } from 'vitest';

import { conditionFromMet, conditionFromWmo, createWeatherService, type FetchLike } from '../src/index.ts';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const OPEN_METEO = fixture('open-meteo-melbourne.json');
const MET = fixture('met-norway-melbourne.json');
const MEL = { lat: -37.81361234, lng: 144.96312345 };
const T0 = new Date('2026-10-18T03:20:00Z');

type Call = { url: string; init?: RequestInit };
type Reply = Response | Error | ((url: string) => Response | Error);

function fakeFetch(replies: { openMeteo: Reply[]; met: Reply[] }) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const queue = url.includes('open-meteo.com') ? replies.openMeteo : replies.met;
    const next = queue.length > 1 ? queue.shift()! : queue[0];
    if (!next) throw new Error(`unexpected call ${url}`);
    const value = typeof next === 'function' ? next(url) : next;
    if (value instanceof Error) throw value;
    return value.clone();
  };
  return { fetch, calls };
}

function setup(replies: { openMeteo: Reply[]; met: Reply[] }) {
  let now = T0;
  const warnings: string[] = [];
  const fake = fakeFetch(replies);
  const service = createWeatherService({ fetch: fake.fetch, now: () => now, log: { warn: (m) => warnings.push(m) } });
  return { service, calls: fake.calls, warnings, advance: (minutes: number) => (now = new Date(now.getTime() + minutes * 60_000)) };
}

const ok = (body: string, headers: Record<string, string> = {}) => new Response(body, { status: 200, headers });
const status = (code: number) => new Response('{}', { status: code });

test('Open-Meteo answers: metric current values and 24 hourly rows in the place zone', async () => {
  const { service, calls } = setup({ openMeteo: [ok(OPEN_METEO)], met: [] });
  const w = await service.get(MEL.lat, MEL.lng);
  expect(WeatherDto.parse(w)).toBeTruthy();
  expect(w).toMatchObject({ source: 'open-meteo', timezone: 'Australia/Melbourne' });
  expect(w!.current).toMatchObject({ temperatureC: 18.4, windKph: 14.8, cloudPct: 40, humidityPct: 61, condition: 'partly_cloudy' });
  expect(w!.current.time).toBe('2026-10-18T14:15:00+11:00');
  expect(w!.hourly).toHaveLength(24);
  expect(w!.hourly[0]!.time).toBe('2026-10-18T14:00:00+11:00');
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toContain('timeformat=unixtime');
  expect(calls[0]!.url).not.toContain('fahrenheit');
});

test('Open-Meteo 503: MET Norway is used, with 4-decimal coordinates and the contact User-Agent', async () => {
  const { service, calls } = setup({ openMeteo: [status(503)], met: [ok(MET)] });
  const w = await service.get(MEL.lat, MEL.lng);
  expect(WeatherDto.parse(w)).toBeTruthy();
  expect(w!.source).toBe('met-norway');
  expect(w!.current).toMatchObject({ temperatureC: 17.5, windKph: 14.4, humidityPct: 63, condition: 'clear' });
  expect(w!.current.time).toBe('2026-10-18T14:00:00+11:00');
  expect(w!.hourly).toHaveLength(24);
  const met = calls.find((c) => c.url.includes('api.met.no'))!;
  expect(met.url).toContain('lat=-37.8136&lon=144.9631');
  expect(new Headers(met.init?.headers).get('user-agent')).toBe('FotoAI-Coach/2 (+https://myfoto.topues.com)');
});

test('Open-Meteo times out twice: MET Norway is used', async () => {
  const { service, calls } = setup({ openMeteo: [new Error('timeout'), new Error('timeout')], met: [ok(MET)] });
  expect((await service.get(MEL.lat, MEL.lng))!.source).toBe('met-norway');
  expect(calls.filter((c) => c.url.includes('open-meteo.com'))).toHaveLength(2);
});

test('an Open-Meteo body that does not parse falls back to MET Norway', async () => {
  const { service } = setup({ openMeteo: [ok('{"current":{}}')], met: [ok(MET)] });
  expect((await service.get(MEL.lat, MEL.lng))!.source).toBe('met-norway');
});

test('both down: null and one warning log', async () => {
  const { service, warnings } = setup({ openMeteo: [status(500)], met: [status(429)] });
  expect(await service.get(MEL.lat, MEL.lng)).toBeNull();
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toMatch(/open-meteo.*500.*met-norway.*429/);
  expect(warnings[0]).not.toMatch(/144\.963|-37\.813/); // at most 2 decimals
});

test('a second call within 15 minutes is served from the cache; after 16 minutes it fetches again', async () => {
  const { service, calls, advance } = setup({ openMeteo: [ok(OPEN_METEO)], met: [] });
  await service.get(MEL.lat, MEL.lng);
  advance(10);
  await service.get(-37.8149, 144.9649); // the same 2-decimal cell
  expect(calls).toHaveLength(1);
  advance(6);
  await service.get(MEL.lat, MEL.lng);
  expect(calls).toHaveLength(2);
});

test('MET Expires is respected: no new MET call before it', async () => {
  const expires = new Date(T0.getTime() + 40 * 60_000).toUTCString();
  const { service, calls, advance } = setup({ openMeteo: [status(503)], met: [ok(MET, { expires })] });
  await service.get(MEL.lat, MEL.lng);
  advance(30);
  await service.get(MEL.lat, MEL.lng);
  expect(calls.filter((c) => c.url.includes('api.met.no'))).toHaveLength(1);
  advance(11);
  await service.get(MEL.lat, MEL.lng);
  expect(calls.filter((c) => c.url.includes('api.met.no'))).toHaveLength(2);
});

test('a null result is not cached', async () => {
  const { service, calls } = setup({ openMeteo: [status(500), ok(OPEN_METEO)], met: [status(500)] });
  expect(await service.get(MEL.lat, MEL.lng)).toBeNull();
  expect((await service.get(MEL.lat, MEL.lng))!.source).toBe('open-meteo');
  expect(calls).toHaveLength(3);
});

test('WMO and MET symbol codes map to the same conditions', () => {
  expect(conditionFromWmo(2)).toBe('partly_cloudy');
  expect(conditionFromMet('partlycloudy_day')).toBe('partly_cloudy');
  expect(conditionFromWmo(95)).toBe('thunder');
  expect(conditionFromMet('heavyrainandthunder')).toBe('thunder');
  expect(conditionFromWmo(0)).toBe('clear');
  expect(conditionFromMet('clearsky_night')).toBe('clear');
  expect(conditionFromWmo(61)).toBe('rain');
  expect(conditionFromMet('lightrainshowers_polartwilight')).toBe('rain');
  expect(conditionFromMet('heavysleet')).toBe('snow');
  expect(conditionFromWmo(1234)).toBe('unknown');
  expect(conditionFromMet('martian_dust')).toBe('unknown');
});

test('the cache holds at most 500 cells; the oldest goes first', async () => {
  const { service, calls } = setup({ openMeteo: [ok(OPEN_METEO)], met: [] });
  await service.get(-37.8136, 144.9631);
  for (let i = 1; i <= 500; i++) await service.get(-37.8136 + i * 0.01, 144.9631);
  const before = calls.length;
  await service.get(-37.8136 + 500 * 0.01, 144.9631); // newest: still cached
  expect(calls.length).toBe(before);
  await service.get(-37.8136, 144.9631); // oldest: evicted
  expect(calls.length).toBe(before + 1);
});
