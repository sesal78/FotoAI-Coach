import { createTokenVerifier } from '@fotoai/db';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import { defineV2Handler, getActiveChallenge, getLoadout, getPreferences, type V2Body, type V2Deps } from '../src/index.ts';

const db = localDbFromEnv();

// The live web login seeds default rows (preferences, progress). A user who signs up in the
// mobile app never passes through it, so every v2 read must still answer with defaults.
describe.skipIf(!db)('a user who never used the web login', () => {
  let deps: V2Deps;
  let u: TestUser;

  beforeAll(async () => {
    const env = testEnv(db!);
    deps = {
      env, now: () => new Date(), verifyToken: createTokenVerifier(env), fetch, weather: { get: async () => null },
      ai: { modelId: 'none', configured: false, generate: async () => { throw new Error('no AI in this test'); }, chat: async () => { throw new Error('no AI in this test'); } },
    };
    u = await createTestUser(db!, 'fresh');
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [u]);
  });

  const get = (body: V2Body, path: string) =>
    defineV2Handler(() => deps, body)(new Request(`http://localhost${path}`, { headers: { authorization: `Bearer ${u.token}` } }), { params: {} });

  test.each([
    ['preferences', getPreferences, '/api/v2/me/preferences'],
    ['active challenge', getActiveChallenge, '/api/v2/challenges/active'],
    ['loadout', getLoadout, '/api/v2/me/loadout'],
  ] as const)('%s answers 200', async (_name, body, path) => {
    const res = await get(body, path);
    expect(res.status, await res.clone().text()).toBe(200);
  });
});
