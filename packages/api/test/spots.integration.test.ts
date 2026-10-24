import { readFileSync } from 'node:fs';

import { createTokenVerifier, createUserClient } from '@fotoai/db';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import { addMySpot, defineV2Handler, deleteMySpot, listMySpots, updateMySpot, type V2Body, type V2Deps } from '../src/index.ts';

const db = localDbFromEnv();
const DETAILS = readFileSync(new URL('../../places/test/fixtures/places-details.json', import.meta.url), 'utf8');
const FED = 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ';
const BROKEN = 'ChIJbrokenPlaceId000000000';
const GONE = 'ChIJgonePlaceId00000000000';

/** Google stand-in: FED resolves, BROKEN fails with 500, GONE is a 404. */
const fakeGoogle = async (url: string) => {
  if (url.includes(BROKEN)) return new Response('{}', { status: 500 });
  if (url.includes(GONE)) return new Response('{}', { status: 404 });
  return new Response(DETAILS, { status: 200 });
};

describe.skipIf(!db)('v2 my spots against the local Supabase', () => {
  let deps: V2Deps;
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    const env = { ...testEnv(db!), GOOGLE_MAPS_SERVER_API_KEY: 'AIzaFAKE-test' };
    deps = { env, now: () => new Date(), verifyToken: createTokenVerifier(env), fetch: fakeGoogle, weather: { get: async () => null }, ai: { modelId: 'none', configured: false, generate: async () => { throw new Error('no AI in this test'); }, chat: async () => { throw new Error('no AI in this test'); } } };
    [a, b] = await Promise.all([createTestUser(db!, 'spots-a'), createTestUser(db!, 'spots-b')]);
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });

  const call = (body: V2Body, user: TestUser, init: { method?: string; json?: unknown; params?: Record<string, string> } = {}) =>
    defineV2Handler(() => deps, body)(
      new Request('http://localhost/api/v2/me/spots', {
        method: init.method ?? 'GET',
        headers: { authorization: `Bearer ${user.token}`, 'content-type': 'application/json' },
        body: init.json === undefined ? undefined : JSON.stringify(init.json),
      }),
      { params: init.params ?? {} },
    );
  const row = async (user: TestUser, id: string) =>
    (await createUserClient(deps.env, user.token).from('fotoai_places').select('*').eq('id', id).single()).data as Record<string, unknown>;

  test('a pin is saved and listed with its own name and coordinates', async () => {
    const res = await call(addMySpot, a, { method: 'POST', json: { pin: { name: 'Point Ormond lookout', lat: -37.8836, lng: 144.9862 }, notes: 'sunset' } });
    expect(res.status).toBe(201);
    const { spot } = await res.json();
    expect(spot).toMatchObject({
      source: 'user', placeId: null, name: 'Point Ormond lookout', location: { lat: -37.8836, lng: 144.9862 }, notes: 'sunset', unavailable: false,
    });
    const list = await (await call(listMySpots, a)).json();
    expect(list.spots.map((s: { id: string }) => s.id)).toContain(spot.id);
  });

  test('a new pin or Google spot is not a favourite until the user marks it', async () => {
    // The column's default is favourite = true; v2 saves set it themselves.
    const pin = (await (await call(addMySpot, b, { method: 'POST', json: { pin: { name: 'Jetty', lat: -37.86, lng: 144.97 } } })).json()).spot;
    const google = (await (await call(addMySpot, b, { method: 'POST', json: { placeId: FED } })).json()).spot;
    expect([pin.favourite, google.favourite]).toEqual([false, false]);
    expect([(await row(b, pin.id)).favourite, (await row(b, google.id)).favourite]).toEqual([false, false]);
    await call(deleteMySpot, b, { method: 'DELETE', params: { id: pin.id } });
    await call(deleteMySpot, b, { method: 'DELETE', params: { id: google.id } });
  });

  test('a Google spot stores only the place id and lists with the fresh name', async () => {
    const res = await call(addMySpot, a, { method: 'POST', json: { placeId: FED, notes: 'steps at dusk' } });
    expect(res.status).toBe(201);
    const { spot } = await res.json();
    expect(spot).toMatchObject({ source: 'google', placeId: FED, name: 'Federation Square', unavailable: false });
    expect(await row(a, spot.id)).toMatchObject({ place_id: FED, name: null, lat: null, lng: null, notes: 'steps at dusk' });
    const list = await (await call(listMySpots, a)).json();
    expect(list.spots.find((s: { id: string }) => s.id === spot.id)).toMatchObject({ name: 'Federation Square', location: { lat: -37.8179789 } });
  });

  test('saving the same Google place twice returns the first row', async () => {
    const first = (await (await call(addMySpot, b, { method: 'POST', json: { placeId: FED } })).json()).spot;
    const again = await call(addMySpot, b, { method: 'POST', json: { placeId: FED } });
    expect(again.status).toBe(200);
    expect((await again.json()).spot.id).toBe(first.id);
  });

  test('a place Google does not know is a 404 and stores nothing', async () => {
    const res = await call(addMySpot, b, { method: 'POST', json: { placeId: GONE } });
    expect(res.status).toBe(404);
    const { data } = await createUserClient(deps.env, b.token).from('fotoai_places').select('id').eq('place_id', GONE);
    expect(data).toHaveLength(0);
  });

  test('one failed Google lookup marks that spot unavailable and the list still answers', async () => {
    const { error } = await createUserClient(deps.env, a.token).from('fotoai_places').insert({ user_id: a.id, source: 'google', place_id: BROKEN } as never);
    expect(error).toBeNull();
    const res = await call(listMySpots, a);
    expect(res.status).toBe(200);
    const spots = (await res.json()).spots as Array<{ placeId: string | null; name: string | null; unavailable: boolean }>;
    expect(spots.find((s) => s.placeId === BROKEN)).toMatchObject({ name: null, unavailable: true });
    expect(spots.find((s) => s.placeId === FED)).toMatchObject({ name: 'Federation Square', unavailable: false });
  });

  test('renaming a Google spot is a 400; notes and favourite change', async () => {
    const list = (await (await call(listMySpots, a)).json()).spots as Array<{ id: string; placeId: string | null }>;
    const google = list.find((s) => s.placeId === FED)!;
    expect((await call(updateMySpot, a, { method: 'PATCH', json: { name: 'Fed Sq' }, params: { id: google.id } })).status).toBe(400);
    const ok = await call(updateMySpot, a, { method: 'PATCH', json: { notes: null, favourite: false }, params: { id: google.id } });
    expect(ok.status).toBe(200);
    expect((await ok.json()).spot).toMatchObject({ notes: null, favourite: false, name: 'Federation Square' });
  });

  test('saving a Google place again with notes updates the notes', async () => {
    const again = await call(addMySpot, b, { method: 'POST', json: { placeId: FED, notes: 'golden hour from the steps' } });
    expect(again.status).toBe(200);
    expect((await again.json()).spot).toMatchObject({ placeId: FED, notes: 'golden hour from the steps' });
  });

  test('with the places limit used up, the list and an edit still answer 200 and Google spots are unavailable', async () => {
    const c = await createTestUser(db!, 'spots-c');
    try {
      const pin = (await (await call(addMySpot, c, { method: 'POST', json: { pin: { name: 'Pier', lat: -37.86, lng: 144.97 } } })).json()).spot;
      const google = (await (await call(addMySpot, c, { method: 'POST', json: { placeId: FED } })).json()).spot;
      const at = new Date().toISOString();
      const { error } = await createUserClient(deps.env, c.token)
        .from('fotoai_agent_actions')
        .insert(Array.from({ length: 120 }, () => ({ user_id: c.id, action_type: 'API_REQUEST_PLACES', details: {}, success: true, executed_at: at })) as never);
      expect(error).toBeNull();
      const list = await call(listMySpots, c);
      expect(list.status).toBe(200);
      const spots = (await list.json()).spots as Array<{ id: string; name: string | null; unavailable: boolean }>;
      expect(spots.find((s) => s.id === pin.id)).toMatchObject({ name: 'Pier', unavailable: false });
      expect(spots.find((s) => s.id === google.id)).toMatchObject({ name: null, unavailable: true });
      const edit = await call(updateMySpot, c, { method: 'PATCH', json: { notes: 'saved anyway' }, params: { id: google.id } });
      expect(edit.status).toBe(200);
      expect((await edit.json()).spot).toMatchObject({ notes: 'saved anyway', unavailable: true });
    } finally {
      await deleteTestUsers(db!, [c]);
    }
  });

  test("another user's spot is a 404 for update and delete", async () => {
    const mine = (await (await call(listMySpots, a)).json()).spots[0] as { id: string };
    expect((await call(updateMySpot, b, { method: 'PATCH', json: { notes: 'x' }, params: { id: mine.id } })).status).toBe(404);
    expect((await call(deleteMySpot, b, { method: 'DELETE', params: { id: mine.id } })).status).toBe(404);
    expect((await call(deleteMySpot, a, { method: 'DELETE', params: { id: mine.id } })).status).toBe(200);
    expect((await call(deleteMySpot, a, { method: 'DELETE', params: { id: 'not-a-uuid' } })).status).toBe(400);
  });
});
