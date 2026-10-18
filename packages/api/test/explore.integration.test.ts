import { readFileSync } from 'node:fs';

import { createTokenVerifier, createUserClient } from '@fotoai/db';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import { addMySpot, defineV2Handler, exploreNearby, exploreSearch, getPlace, getPlacePhoto, type V2Body, type V2Deps } from '../src/index.ts';

const db = localDbFromEnv();
const KEY = 'AIzaFAKE-explore-key';
const fixture = (name: string) => readFileSync(new URL(`../../places/test/fixtures/${name}`, import.meta.url), 'utf8');
const FED = 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ';
const PHOTO = `places/${FED}/photos/AXCi2Q1photoRef0123456789abcdef`;

const fakeGoogle = async (url: string) => {
  if (url.includes(':searchNearby')) return new Response(fixture('places-nearby.json'));
  if (url.includes(':searchText')) return new Response(fixture('places-search.json'));
  if (url.includes('/media')) return new Response(fixture('places-photo.json'));
  return new Response(fixture('places-details.json'));
};

describe.skipIf(!db)('v2 explore and place endpoints against the local Supabase', () => {
  let deps: V2Deps;
  let a: TestUser;

  beforeAll(async () => {
    const env = { ...testEnv(db!), GOOGLE_MAPS_SERVER_API_KEY: KEY };
    deps = { env, now: () => new Date(), verifyToken: createTokenVerifier(env), fetch: fakeGoogle, weather: { get: async () => null } };
    a = await createTestUser(db!, 'explore-a');
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [a]);
  });

  const call = (body: V2Body, path: string, params: Record<string, string> = {}, json?: unknown) =>
    defineV2Handler(() => deps, body)(
      new Request(`http://localhost${path}`, {
        method: json === undefined ? 'GET' : 'POST',
        headers: { authorization: `Bearer ${a.token}`, 'content-type': 'application/json' },
        body: json === undefined ? undefined : JSON.stringify(json),
      }),
      { params },
    );

  test('responses never contain the Google key', async () => {
    const bodies = [
      await call(exploreNearby, '/api/v2/explore/nearby?lat=-37.8183&lng=144.9671'),
      await call(exploreSearch, '/api/v2/explore/search?q=Shrine&lat=-37.8183&lng=144.9671'),
      await call(getPlace, `/api/v2/places/${FED}`, { placeId: FED }),
      await call(getPlacePhoto, `/api/v2/places/${FED}/photo?name=${encodeURIComponent(PHOTO)}`, { placeId: FED }),
    ];
    for (const res of bodies) {
      expect(res.status).toBe(200);
      expect(await res.text()).not.toContain(KEY);
    }
  });

  test('getPlace returns details, light and my saved spot for that place', async () => {
    expect((await call(addMySpot, '/api/v2/me/spots', {}, { placeId: FED, notes: 'steps' })).status).toBe(201);
    const res = await call(getPlace, `/api/v2/places/${FED}`, { placeId: FED });
    const body = await res.json();
    expect(body.place).toMatchObject({ placeId: FED, name: 'Federation Square', formattedAddress: expect.stringContaining('Melbourne') });
    expect(body.light).toMatchObject({ timezone: 'Australia/Melbourne' });
    expect(body.weather).toBeNull();
    expect(body.spot).toMatchObject({ placeId: FED, notes: 'steps', name: 'Federation Square' });
    const photo = await (await call(getPlacePhoto, `/api/v2/places/${FED}/photo?name=${encodeURIComponent(PHOTO)}`, { placeId: FED })).json();
    // Attributions travel with each PhotoRef in the list and detail answers; the media call has none.
    expect(photo).toEqual({ photoUri: expect.stringMatching(/^https:\/\/lh3\.googleusercontent\.com\//) });
  });

  test('the 121st nearby call in an hour is 429', async () => {
    const used = (await createUserClient(deps.env, a.token)
      .from('fotoai_agent_actions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', a.id)
      .eq('action_type', 'API_REQUEST_PLACES')).count ?? 0;
    const at = new Date().toISOString();
    const { error } = await createUserClient(deps.env, a.token)
      .from('fotoai_agent_actions')
      .insert(Array.from({ length: 120 - used }, () => ({ user_id: a.id, action_type: 'API_REQUEST_PLACES', details: {}, success: true, executed_at: at })) as never);
    expect(error).toBeNull();
    const res = await call(exploreNearby, '/api/v2/explore/nearby?lat=-37.8183&lng=144.9671');
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('rate_limited');
  });
});
