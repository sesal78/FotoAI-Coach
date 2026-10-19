import { readEnv } from '../env';

const good = {
  EXPO_PUBLIC_API_URL: 'https://myfoto.topues.com',
  EXPO_PUBLIC_SUPABASE_URL: 'https://supabase.techiesandbox.com',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-value',
  EXPO_PUBLIC_SENTRY_DSN: undefined,
};

test('a full env is accepted; the Sentry DSN is optional', () => {
  const out = readEnv(good);
  expect(out).toEqual({ ok: true, env: { ...good, EXPO_PUBLIC_SENTRY_DSN: undefined } });
});

test('a missing or bad value names the variable, not the value', () => {
  const out = readEnv({ ...good, EXPO_PUBLIC_API_URL: 'http://plain-http.example', EXPO_PUBLIC_SUPABASE_ANON_KEY: '' });
  expect(out.ok).toBe(false);
  if (out.ok) return;
  expect(out.problems.sort()).toEqual(['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']);
  expect(JSON.stringify(out)).not.toContain('plain-http.example');
});
