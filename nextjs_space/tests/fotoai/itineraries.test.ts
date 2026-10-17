// GET/POST /api/fotoai/itineraries (session-only, owner-scoped).

import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';

import { createItineraryHandlers } from '../../lib/fotoai/handlers/itineraries.ts';
import { ALICE, BOB, TOKEN_ALICE } from './helpers/fake-supabase.ts';
import { cookieFor, createTestDeps, jsonRequest, request, type TestDeps } from './helpers/deps.ts';

const URL_IT = '/api/fotoai/itineraries';
const T_IT = 'fotoai_itineraries';
const aliceCookie = cookieFor(TOKEN_ALICE);

let deps: TestDeps;
let itineraries: ReturnType<typeof createItineraryHandlers>;

const LLM_ITINERARY = {
  title: 'Laneways at dusk',
  description: 'Graffiti and neon',
  spots: [{ name: 'Hosier Lane', location: 'CBD', bestTime: 'Golden hour', photoOpportunities: ['murals'], tips: 'Go early' }],
  suggestedTimes: ['Start 5 PM'],
  gearRecommendations: ['35mm'],
};

function rowsOf(table: string, user: string) {
  return (deps.client.tables.get(table) ?? []).filter((r) => r.user_id === user);
}

beforeEach(() => {
  deps = createTestDeps();
  itineraries = createItineraryHandlers(() => deps);
  deps.client.seed('fotoai_user_preferences', { user_id: ALICE, skill_level: 'advanced', photography_interests: ['street'] });
  deps.client.seed('fotoai_user_preferences', { user_id: BOB, skill_level: 'beginner', photography_interests: ['macro'] });
  deps.client.seed('fotoai_user_gear', { user_id: ALICE, category: 'camera', brand: 'Fujifilm', model: 'X-T5' });
  deps.client.seed('fotoai_user_gear', { user_id: BOB, category: 'camera', brand: 'Canon', model: 'R5' });
  deps.fakes.getWeather = () => ({ condition: 'Clear', temperature: 70 });
  deps.fakes.generateItinerary = () => structuredClone(LLM_ITINERARY);
});

test('itineraries: list returns only the caller\'s rows as camelCase with parsed spots', async () => {
  deps.client.seed(T_IT, {
    user_id: ALICE, location: 'CBD', title: 'Mine', spots: JSON.stringify(LLM_ITINERARY.spots),
    suggested_times: ['5 PM'], gear_recommendations: ['35mm'], weather_conditions: 'Clear, 70°F',
    status: 'generated', generated_date: '2026-09-01T00:00:00Z',
  });
  deps.client.seed(T_IT, { user_id: BOB, location: 'Paris', title: 'Bob', spots: [], status: 'generated', generated_date: '2026-09-02T00:00:00Z' });

  const res = await itineraries.list(request(`${URL_IT}?limit=500`, { cookie: aliceCookie }));
  assert.equal(res.status, 200);
  const { itineraries: list } = await res.json();
  assert.equal(list.length, 1);
  assert.equal(list[0].title, 'Mine');
  assert.equal(list[0].spots[0].name, 'Hosier Lane');
  assert.deepEqual(list[0].suggestedTimes, ['5 PM']);
  assert.deepEqual(list[0].gearRecommendations, ['35mm']);
  assert.equal(list[0].weatherConditions, 'Clear, 70°F');
  assert.equal(list[0].generatedDate, '2026-09-01T00:00:00Z');
  assert.equal(list[0].user_id, undefined);
});

test('itineraries: create uses the caller\'s profile, saves an owned row and logs ITINERARY_GENERATED', async () => {
  const res = await itineraries.create(jsonRequest(URL_IT, { location: 'Melbourne CBD', duration: '2-3 hours' }, { cookie: aliceCookie }));
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.message, 'Itinerary generated successfully');
  assert.equal(body.itinerary.title, 'Laneways at dusk');
  assert.equal(body.itinerary.spots.length, 1);

  const gen = deps.calls.find((c) => c.name === 'generateItinerary')!;
  const ctx = gen.args[0] as any;
  assert.equal(ctx.location, 'Melbourne CBD');
  assert.equal(ctx.duration, '2-3 hours');
  assert.equal(ctx.userProfile.skillLevel, 'advanced');
  assert.deepEqual(ctx.userProfile.gear, ['Fujifilm X-T5']);
  assert.deepEqual(ctx.userProfile.interests, ['street']);
  assert.deepEqual(deps.calls.find((c) => c.name === 'getWeather')!.args, ['Melbourne CBD']);

  const [row] = rowsOf(T_IT, ALICE);
  assert.equal(row.id, body.itinerary.id);
  assert.ok(Array.isArray(row.spots), 'spots stored as jsonb array');
  assert.deepEqual(row.suggested_times, ['Start 5 PM']);
  assert.equal(row.weather_conditions, 'Clear, 70°F');
  assert.equal(row.status, 'generated');
  assert.equal(rowsOf(T_IT, BOB).length, 0);
  const [action] = rowsOf('fotoai_agent_actions', ALICE);
  assert.equal(action.action_type, 'ITINERARY_GENERATED');
  assert.equal(action.details.spotsCount, 1);
  assert.equal(deps.client.serviceCalls.length, 0);
});

test('itineraries: 401 without session; 400 for userId and bad input', async () => {
  assert.equal((await itineraries.list(request(URL_IT))).status, 401);
  assert.equal((await itineraries.create(jsonRequest(URL_IT, { location: 'CBD' }))).status, 401);
  assert.equal((await itineraries.list(request(`${URL_IT}?userId=${BOB}`, { cookie: aliceCookie }))).status, 400);
  for (const bad of [
    { location: 'CBD', userId: BOB },
    {},
    { location: '   ' },
    { location: 'x'.repeat(121) },
    { location: 'CBD', duration: 7 },
    { location: 'CBD', extra: true },
  ]) {
    const res = await itineraries.create(jsonRequest(URL_IT, bad, { cookie: aliceCookie }));
    assert.equal(res.status, 400, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal(deps.calls.length, 0);
});

test('itineraries: LLM failure is a 502 with nothing saved; missing preferences is a 404', async () => {
  deps.fakes.generateItinerary = () => { throw new Error('Failed to generate photography itinerary'); };
  let res = await itineraries.create(jsonRequest(URL_IT, { location: 'CBD' }, { cookie: aliceCookie }));
  assert.equal(res.status, 502);
  assert.equal(rowsOf(T_IT, ALICE).length, 0);
  assert.equal(rowsOf('fotoai_agent_actions', ALICE).length, 0);

  deps.client.tables.set('fotoai_user_preferences', []);
  res = await itineraries.create(jsonRequest(URL_IT, { location: 'CBD' }, { cookie: aliceCookie }));
  assert.equal(res.status, 404);
});
