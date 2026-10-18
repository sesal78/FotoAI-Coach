import { LightTimesDto, WeatherDto } from '@fotoai/contracts';
import { expect, test } from 'vitest';

import { defineV2Handler, exploreNearby, exploreSearch, getConditions, getPlace, getPlacePhoto, type V2Body, type V2Deps } from '../src/index.ts';

const USER = '11111111-2222-4333-8444-555555555555';
const FED = 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ';
const weather: WeatherDto = {
  source: 'open-meteo',
  attribution: 'Weather data by Open-Meteo.com (CC BY 4.0)',
  fetchedAt: '2026-10-18T14:20:00+11:00',
  timezone: 'Australia/Melbourne',
  current: { time: '2026-10-18T14:15:00+11:00', temperatureC: 18, windKph: 12, cloudPct: 40, precipitationMm: 0, humidityPct: 60, condition: 'partly_cloudy' },
  hourly: [],
};

function makeDeps(opts: { key?: string; weather?: WeatherDto | null } = {}) {
  const outside: string[] = [];
  const deps = {
    env: {
      FOTOAI_SUPABASE_URL: 'http://127.0.0.1:1',
      FOTOAI_SUPABASE_ANON_KEY: 'anon',
      FOTOAI_SUPABASE_SERVICE_ROLE_KEY: 'svc',
      FOTOAI_COOKIE_SECURE: false,
      NODE_ENV: 'test',
      GOOGLE_MAPS_SERVER_API_KEY: opts.key,
    },
    now: () => new Date('2026-10-18T03:20:00Z'),
    verifyToken: async (token: string) => (token === 'good' ? { userId: USER, email: null } : null),
    fetch: async (url: string) => {
      outside.push(url);
      return new Response('{}', { status: 500 });
    },
    weather: { get: async () => (opts.weather === undefined ? weather : opts.weather) },
  } as V2Deps;
  return { deps, outside };
}

const call = (body: V2Body, deps: V2Deps, path: string, init: { token?: string | null; params?: Record<string, string> } = {}) =>
  defineV2Handler(() => deps, body)(
    new Request(`http://localhost${path}`, { headers: init.token === null ? {} : { authorization: `Bearer ${init.token ?? 'good'}` } }),
    { params: init.params ?? {} },
  );

test('conditions returns light and weather; weather down gives weather null with 200', async () => {
  const up = await call(getConditions, makeDeps().deps, '/api/v2/conditions?lat=-37.8136&lng=144.9631&date=2026-10-18');
  expect(up.status).toBe(200);
  const body = await up.json();
  expect(LightTimesDto.parse(body.light)).toMatchObject({ date: '2026-10-18', timezone: 'Australia/Melbourne' });
  expect(WeatherDto.parse(body.weather)).toMatchObject({ source: 'open-meteo' });
  const down = await call(getConditions, makeDeps({ weather: null }).deps, '/api/v2/conditions?lat=-37.8136&lng=144.9631');
  expect(down.status).toBe(200);
  expect((await down.json()).weather).toBeNull();
});

test('nearby without a token is 401 and makes no outside call', async () => {
  const { deps, outside } = makeDeps({ key: 'AIzaFAKE' });
  for (const [body, path] of [
    [exploreNearby, '/api/v2/explore/nearby?lat=-37.8&lng=144.9'],
    [exploreSearch, '/api/v2/explore/search?q=beach'],
    [getConditions, '/api/v2/conditions?lat=-37.8&lng=144.9'],
  ] as const) {
    expect((await call(body, deps, path, { token: null })).status).toBe(401);
  }
  expect((await call(getPlace, deps, `/api/v2/places/${FED}`, { token: null, params: { placeId: FED } })).status).toBe(401);
  expect(outside).toHaveLength(0);
});

test('bad coordinates and queries are 400 before any reservation or outside call', async () => {
  const { deps, outside } = makeDeps({ key: 'AIzaFAKE' });
  for (const [body, path] of [
    [exploreNearby, '/api/v2/explore/nearby?lat=91&lng=144.9'],
    [exploreNearby, '/api/v2/explore/nearby?lat=-37.8'],
    [exploreNearby, '/api/v2/explore/nearby?lat=-37.8&lng=144.9&radiusM=60000'],
    [exploreNearby, '/api/v2/explore/nearby?lat=-37.8&lng=144.9&type=Bad%20Type'],
    [exploreNearby, '/api/v2/explore/nearby?lat=-37.8&lng=144.9&user_id=x'],
    [exploreSearch, '/api/v2/explore/search?q='],
    [exploreSearch, '/api/v2/explore/search?q=beach&lat=-37.8'],
    [getConditions, '/api/v2/conditions?lat=abc&lng=1'],
    [getConditions, '/api/v2/conditions?lat=1&lng=1&date=2026-02-30'],
  ] as const) {
    const res = await call(body, deps, path);
    expect(res.status, path).toBe(400);
    expect((await res.json()).code, path).toBe('validation');
  }
  expect((await call(getPlace, deps, '/api/v2/places/bad', { params: { placeId: 'bad!' } })).status).toBe(400);
  expect(outside).toHaveLength(0);
});

test('no Google key is a 500 config error, not a crash', async () => {
  const { deps, outside } = makeDeps();
  const res = await call(exploreNearby, deps, '/api/v2/explore/nearby?lat=-37.8&lng=144.9');
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ error: 'Places is not configured', code: 'config' });
  expect((await call(getPlace, deps, `/api/v2/places/${FED}`, { params: { placeId: FED } })).status).toBe(500);
  expect(outside).toHaveLength(0);
});

test('a photo name from another place is 400', async () => {
  const { deps, outside } = makeDeps({ key: 'AIzaFAKE' });
  const other = 'places/ChIJiYrPnj5d1moRk5nGq2b0F4w/photos/AXCi2Q1photoRef0123456789abcdef';
  const res = await call(getPlacePhoto, deps, `/api/v2/places/${FED}/photo?name=${encodeURIComponent(other)}`, { params: { placeId: FED } });
  expect(res.status).toBe(400);
  const big = `places/${FED}/photos/AXCi2Q1photoRef0123456789abcdef`;
  const tooBig = await call(getPlacePhoto, deps, `/api/v2/places/${FED}/photo?name=${encodeURIComponent(big)}&maxPx=5000`, { params: { placeId: FED } });
  expect(tooBig.status).toBe(400);
  expect(outside).toHaveLength(0);
});
