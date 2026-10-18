import { readFileSync } from 'node:fs';

import { createAi } from '@fotoai/ai';
import { createTokenVerifier, createUserClient } from '@fotoai/db';
import { MockLanguageModelV4 } from 'ai/test';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { localDbFromEnv } from '../../db/test/support/local-db.ts';
import { createTestUser, deleteTestUsers, testEnv, type TestUser } from '../../db/test/support/seed.ts';
import { addMySpot, defineV2Handler, explainGooglePlace, explainSpot, type V2Body, type V2Deps } from '../src/index.ts';

const db = localDbFromEnv();
const DETAILS = readFileSync(new URL('../../places/test/fixtures/places-details.json', import.meta.url), 'utf8');
const FED = 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ';
const ANSWER = JSON.stringify({ bestLight: 'Late golden hour.', angles: ['Low from the steps'], caution: null });

describe.skipIf(!db)('v2 place explanation against the local Supabase', () => {
  let deps: V2Deps;
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    const env = { ...testEnv(db!), GOOGLE_MAPS_SERVER_API_KEY: 'AIzaFAKE-test', OPENAI_API_KEY: 'sk-test' };
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: 'text', text: ANSWER }],
        finishReason: { unified: 'stop', raw: undefined },
        usage: { inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 40, text: 40, reasoning: 0 } },
        warnings: [],
      }),
    });
    deps = {
      env,
      now: () => new Date(),
      verifyToken: createTokenVerifier(env),
      fetch: async () => new Response(DETAILS),
      weather: { get: async () => null },
      ai: createAi({ apiKey: 'sk-test', modelId: 'gpt-6-luna', model, log: { info: () => undefined, warn: () => undefined } }),
    };
    [a, b] = await Promise.all([createTestUser(db!, 'explain-a'), createTestUser(db!, 'explain-b')]);
  });
  afterAll(async () => {
    await deleteTestUsers(db!, [a, b]);
  });

  const call = (body: V2Body, user: TestUser, params: Record<string, string>, json?: unknown) =>
    defineV2Handler(() => deps, body)(
      new Request('http://localhost/api/v2/x', {
        method: json === undefined ? 'GET' : 'POST',
        headers: { authorization: `Bearer ${user.token}`, 'content-type': 'application/json' },
        body: json === undefined ? undefined : JSON.stringify(json),
      }),
      { params },
    );

  test('a Google place explanation answers 200 and stores nothing', async () => {
    const before = (await createUserClient(deps.env, a.token).from('fotoai_places').select('id', { count: 'exact', head: true })).count;
    const res = await call(explainGooglePlace, a, { placeId: FED });
    expect(res.status).toBe(200);
    expect((await res.json()).explanation).toMatchObject({ bestLight: 'Late golden hour.', angles: ['Low from the steps'] });
    const after = (await createUserClient(deps.env, a.token).from('fotoai_places').select('id', { count: 'exact', head: true })).count;
    expect(after).toBe(before);
  });

  test("a pin explanation works for its owner; another user's spot is a 404", async () => {
    const spot = (await (await call(addMySpot, a, {}, { pin: { name: 'Lookout', lat: -37.88, lng: 144.98 }, notes: 'faces west' })).json()).spot;
    expect((await call(explainSpot, a, { id: spot.id })).status).toBe(200);
    expect((await call(explainSpot, b, { id: spot.id })).status).toBe(404);
  });

  test('the 61st explanation in an hour is 429', async () => {
    const used = (await createUserClient(deps.env, a.token)
      .from('fotoai_agent_actions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', a.id)
      .eq('action_type', 'API_REQUEST_PLACE_EXPLAIN')).count ?? 0;
    const at = new Date().toISOString();
    await createUserClient(deps.env, a.token)
      .from('fotoai_agent_actions')
      .insert(Array.from({ length: 60 - used }, () => ({ user_id: a.id, action_type: 'API_REQUEST_PLACE_EXPLAIN', details: {}, success: true, executed_at: at })) as never);
    const res = await call(explainGooglePlace, a, { placeId: FED });
    expect(res.status).toBe(429);
  });
});
