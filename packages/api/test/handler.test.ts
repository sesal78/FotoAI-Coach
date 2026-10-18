import { expect, test } from 'vitest';

import { ApiError, defineV2Handler, json, type V2Deps } from '../src/index.ts';

const fakeDeps = {
  env: {
    FOTOAI_SUPABASE_URL: 'http://127.0.0.1:54321',
    FOTOAI_SUPABASE_ANON_KEY: 'anon',
    FOTOAI_SUPABASE_SERVICE_ROLE_KEY: 'svc',
    FOTOAI_COOKIE_SECURE: false,
    NODE_ENV: 'test',
    FOTOAI_AI_MODEL: 'gpt-6-luna',
  },
  now: () => new Date('2026-10-18T00:00:00Z'),
  verifyToken: async () => null,
  fetch: async () => new Response('{}'),
  weather: { get: async () => null },
} as V2Deps;

test('importing a v2 route module does not read env or build deps', async () => {
  let built = 0;
  const handler = defineV2Handler(() => {
    built++;
    return fakeDeps;
  }, async () => json({ ok: true }));
  expect(built).toBe(0);
  await handler(new Request('http://x/api/v2/health'));
  expect(built).toBe(1);
});

test('an ApiError becomes its envelope and status', async () => {
  const res = await defineV2Handler(() => fakeDeps, async () => {
    throw new ApiError('not_found', 'No such plan');
  })(new Request('http://x'));
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: 'No such plan', code: 'not_found' });
});

test('an unknown error is a 500 internal envelope without the message', async () => {
  const res = await defineV2Handler(() => fakeDeps, async () => {
    throw new Error('db password=hunter2');
  })(new Request('http://x'));
  expect(res.status).toBe(500);
  const text = await res.text();
  expect(JSON.parse(text)).toEqual({ error: 'Internal error', code: 'internal' });
  expect(text).not.toContain('hunter2');
});

test('a deps provider that throws is still an envelope, not a crash', async () => {
  const res = await defineV2Handler(() => {
    throw new Error('FotoAI env invalid: FOTOAI_SUPABASE_URL');
  }, async () => json({ ok: true }))(new Request('http://x'));
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ error: 'Internal error', code: 'internal' });
});

test('route params are passed through, awaited when Next gives a promise', async () => {
  const handler = defineV2Handler(() => fakeDeps, async (_req, _deps, ctx) => json(ctx.params));
  const res = await handler(new Request('http://x'), { params: Promise.resolve({ id: 'abc' }) });
  expect(await res.json()).toEqual({ id: 'abc' });
});
