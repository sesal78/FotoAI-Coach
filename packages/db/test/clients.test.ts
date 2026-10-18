import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('@supabase/supabase-js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@supabase/supabase-js')>();
  return { ...actual, createClient: vi.fn(actual.createClient) };
});

const { createClient } = await import('@supabase/supabase-js');
const { createUserClient } = await import('../src/index.ts');
const { createServiceClient } = await import('../src/service-client.ts');

const env = {
  FOTOAI_SUPABASE_URL: 'http://127.0.0.1:54321',
  FOTOAI_SUPABASE_ANON_KEY: 'anon',
  FOTOAI_SUPABASE_SERVICE_ROLE_KEY: 'svc',
};

beforeEach(() => {
  vi.mocked(createClient).mockClear();
});

test('user client sends the anon key as apikey and the user token as bearer', async () => {
  const seen: Headers[] = [];
  const client = createUserClient(env, 'user-token', {
    fetch: async (_url, init) => {
      seen.push(new Headers(init?.headers));
      return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
    },
  });
  await client.from('fotoai_user_gear').select('id');
  expect(seen[0]!.get('apikey')).toBe('anon');
  expect(seen[0]!.get('authorization')).toBe('Bearer user-token');
});

test('user client rejects an empty token', () => {
  expect(() => createUserClient(env, '')).toThrow(/access token/);
  expect(() => createUserClient(env, '   ')).toThrow(/access token/);
});

test('user client never persists or refreshes a session', () => {
  createUserClient(env, 'user-token');
  const options = vi.mocked(createClient).mock.calls[0]![2];
  expect(options?.auth).toMatchObject({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
});

test('service client uses the service role key and never persists a session', () => {
  createServiceClient(env);
  const [, key, options] = vi.mocked(createClient).mock.calls[0]!;
  expect(key).toBe('svc');
  expect(options?.auth).toMatchObject({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
});
