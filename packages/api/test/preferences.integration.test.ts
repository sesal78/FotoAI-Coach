import { createTokenVerifier } from '@fotoai/db';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import { defineV2Handler, getPreferences, patchPreferences, type V2Deps } from '../src/index.ts';

const db = localDbFromEnv();

describe.skipIf(!db)('v2 preferences against the local Supabase', () => {
  let deps: V2Deps;
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    const env = testEnv(db!);
    deps = { env, now: () => new Date(), verifyToken: createTokenVerifier(env), fetch, weather: { get: async () => null } };
    [a, b] = await Promise.all([createTestUser(db!, 'prefs-a'), createTestUser(db!, 'prefs-b')]);
  });

  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });

  const get = (user: TestUser) =>
    defineV2Handler(() => deps, getPreferences)(
      new Request('http://localhost/api/v2/me/preferences', { headers: { authorization: `Bearer ${user.token}` } }),
    );
  const patch = (user: TestUser, body: unknown, query = '') =>
    defineV2Handler(() => deps, patchPreferences)(
      new Request(`http://localhost/api/v2/me/preferences${query}`, {
        method: 'PATCH',
        headers: { authorization: `Bearer ${user.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );

  test('preferences default to golden, metric, no home when no row exists', async () => {
    const res = await get(a);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ theme: 'golden', units: 'metric', home: null });
  });

  test('patch sets theme and home, and get returns them', async () => {
    const res = await patch(a, { theme: 'camera', home: { lat: -37.8183, lng: 144.9671, label: 'Flinders St' } });
    expect(res.status).toBe(200);
    const expected = { theme: 'camera', units: 'metric', home: { lat: -37.8183, lng: 144.9671, label: 'Flinders St' } };
    expect(await res.json()).toEqual(expected);
    expect(await (await get(a)).json()).toEqual(expected);

    const cleared = await patch(a, { home: null });
    expect((await cleared.json()).home).toBeNull();
  });

  test('patch rejects an unknown theme, an out-of-range latitude, a lat without lng, and identity keys', async () => {
    for (const body of [{ theme: 'neon' }, { home: { lat: 95, lng: 1 } }, { home: { lat: 1 } }, { user_id: b.id }]) {
      const res = await patch(a, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect((await res.json()).code).toBe('validation');
    }
    expect((await patch(a, { theme: 'golden' }, `?user_id=${b.id}`)).status).toBe(400);
    const notJson = await defineV2Handler(() => deps, patchPreferences)(
      new Request('http://localhost/api/v2/me/preferences', {
        method: 'PATCH',
        headers: { authorization: `Bearer ${a.token}` },
        body: '{not json',
      }),
    );
    expect(notJson.status).toBe(400);
  });

  test("one user's patch never changes another user's preferences", async () => {
    await patch(b, { theme: 'golden_dark', units: 'imperial' });
    await patch(a, { theme: 'camera' });
    expect(await (await get(b)).json()).toEqual({ theme: 'golden_dark', units: 'imperial', home: null });
  });
});
