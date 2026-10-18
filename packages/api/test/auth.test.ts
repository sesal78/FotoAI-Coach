import { expect, test } from 'vitest';

import { rejectBrowserIdentity, requirePrincipal, type V2Deps } from '../src/index.ts';

const USER = '11111111-2222-4333-8444-555555555555';
const deps = {
  env: {
    FOTOAI_SUPABASE_URL: 'http://127.0.0.1:54321',
    FOTOAI_SUPABASE_ANON_KEY: 'anon',
    FOTOAI_SUPABASE_SERVICE_ROLE_KEY: 'svc',
    FOTOAI_COOKIE_SECURE: false,
    NODE_ENV: 'test',
    FOTOAI_AI_MODEL: 'gpt-6-luna',
  },
  now: () => new Date('2026-10-18T00:00:00Z'),
  verifyToken: async (token: string) => {
    if (token === 'good') return { userId: USER.toUpperCase(), email: 'a@localhost.test' };
    if (token === 'other') return { userId: '99999999-2222-4333-8444-555555555555', email: null };
    if (token === 'not-a-uuid-user') return { userId: 'abc', email: null };
    return null;
  },
  fetch: async () => new Response('{}'),
  weather: { get: async () => null },
} as V2Deps;

const req = (headers: Record<string, string>) => new Request('http://x/api/v2/me', { headers });

test('rejects malformed Authorization headers', async () => {
  for (const header of ['Bearer ', 'Bearer  two words', 'Basic abc', 'good', `Bearer ${'x'.repeat(8193)}`]) {
    await expect(requirePrincipal(req({ authorization: header }), deps), header.slice(0, 20)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  }
});

test('accepts a lowercase bearer scheme and lowercases the user id', async () => {
  const p = await requirePrincipal(req({ authorization: 'bearer good' }), deps);
  expect(p).toEqual({ userId: USER, email: 'a@localhost.test', accessToken: 'good' });
});

test('prefers the bearer token over the cookie', async () => {
  const p = await requirePrincipal(req({ authorization: 'Bearer good', cookie: 'fotoai_session=other' }), deps);
  expect(p.accessToken).toBe('good');
});

test('falls back to the fotoai_session cookie', async () => {
  const p = await requirePrincipal(req({ cookie: 'theme=dark; fotoai_session=good; x=1' }), deps);
  expect(p.userId).toBe(USER);
});

test('no token at all is 401', async () => {
  await expect(requirePrincipal(req({ cookie: 'theme=dark' }), deps)).rejects.toMatchObject({ code: 'unauthenticated' });
});

test('a token the verifier rejects is 401', async () => {
  await expect(requirePrincipal(req({ authorization: 'Bearer expired' }), deps)).rejects.toMatchObject({
    code: 'unauthenticated',
  });
});

test('a verified user id that is not a UUID is 401', async () => {
  await expect(requirePrincipal(req({ authorization: 'Bearer not-a-uuid-user' }), deps)).rejects.toMatchObject({
    code: 'unauthenticated',
  });
});

test('rejects browser-supplied identity', () => {
  for (const key of ['userId', 'user_id', 'userid', 'ownerId', 'owner_id']) {
    expect(() => rejectBrowserIdentity(new URLSearchParams(`${key}=abc`))).toThrow(expect.objectContaining({ code: 'validation' }));
    expect(() => rejectBrowserIdentity({ [key]: 'abc' })).toThrow(expect.objectContaining({ code: 'validation' }));
  }
  expect(() => rejectBrowserIdentity(new URLSearchParams('status=pending'))).not.toThrow();
  expect(() => rejectBrowserIdentity(null)).not.toThrow();
});

test('a malformed percent-encoded session cookie is 401, not a crash', async () => {
  for (const cookie of ['fotoai_session=%', 'fotoai_session=%E0%A4%A']) {
    await expect(requirePrincipal(req({ cookie }), deps), cookie).rejects.toMatchObject({ code: 'unauthenticated' });
  }
});
