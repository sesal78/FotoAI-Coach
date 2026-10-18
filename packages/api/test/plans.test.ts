import { createAi } from '@fotoai/ai';
import { MockLanguageModelV4 } from 'ai/test';
import { expect, test } from 'vitest';

import { defineV2Handler, generatePlan, type V2Deps } from '../src/index.ts';

const USER = '11111111-2222-4333-8444-555555555555';
const FED = 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ';

/** Deps whose database is unreachable (127.0.0.1:1): any reservation attempt would surface as a 502. */
function makeDeps(opts: { aiKey?: string } = {}) {
  const outside: string[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error('the model must not be called in these tests');
    },
  });
  const deps = {
    env: {
      FOTOAI_SUPABASE_URL: 'http://127.0.0.1:1',
      FOTOAI_SUPABASE_ANON_KEY: 'anon',
      FOTOAI_SUPABASE_SERVICE_ROLE_KEY: 'svc',
      FOTOAI_COOKIE_SECURE: false,
      NODE_ENV: 'test',
      FOTOAI_AI_MODEL: 'gpt-6-luna',
      GOOGLE_MAPS_SERVER_API_KEY: 'AIzaFAKE',
      OPENAI_API_KEY: opts.aiKey,
    },
    now: () => new Date('2026-10-18T03:20:00Z'),
    verifyToken: async (token: string) => (token === 'good' ? { userId: USER, email: null } : null),
    fetch: async (url: string) => {
      outside.push(url);
      return new Response('{}', { status: 500 });
    },
    weather: { get: async () => null },
    ai: opts.aiKey ? createAi({ apiKey: opts.aiKey, modelId: 'gpt-6-luna', model }) : createAi({ apiKey: undefined, modelId: 'gpt-6-luna' }),
  } as V2Deps;
  return { deps, outside, model };
}

const post = (deps: V2Deps, body: unknown, token: string | null = 'good') =>
  defineV2Handler(() => deps, generatePlan)(
    new Request('http://localhost/api/v2/plans', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
  );

test('without a token it is 401 and the model is never called', async () => {
  const { deps, outside, model } = makeDeps({ aiKey: 'sk-test' });
  expect((await post(deps, { placeId: FED }, null)).status).toBe(401);
  expect(model.doGenerateCalls).toHaveLength(0);
  expect(outside).toHaveLength(0);
});

test('no OpenAI key is a 500 config error before any reservation', async () => {
  const { deps, outside } = makeDeps();
  const res = await post(deps, { placeId: FED });
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ error: 'AI is not configured', code: 'config' });
  expect(outside).toHaveLength(0);
});

test('a bad body is 400 before any reservation', async () => {
  const { deps, outside, model } = makeDeps({ aiKey: 'sk-test' });
  for (const body of [{}, { placeId: FED, spotId: USER }, { placeId: 'bad!' }, { placeId: FED, user_id: USER }]) {
    const res = await post(deps, body);
    expect(res.status, JSON.stringify(body)).toBe(400);
  }
  expect(model.doGenerateCalls).toHaveLength(0);
  expect(outside).toHaveLength(0);
});
