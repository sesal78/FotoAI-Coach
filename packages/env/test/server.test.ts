import { expect, test } from 'vitest';

import { createServerEnv } from '../src/index.ts';

const ok = {
  FOTOAI_SUPABASE_URL: 'https://db.example.com',
  FOTOAI_SUPABASE_ANON_KEY: 'anon',
  FOTOAI_SUPABASE_SERVICE_ROLE_KEY: 'svc',
  NODE_ENV: 'production',
};

test('throws listing all missing required variables', () => {
  expect(() => createServerEnv({ NODE_ENV: 'production' })).toThrow(
    /FOTOAI_SUPABASE_URL.*FOTOAI_SUPABASE_ANON_KEY.*FOTOAI_SUPABASE_SERVICE_ROLE_KEY/s,
  );
});

test('strips trailing slashes and trims whitespace', () => {
  const env = createServerEnv({ ...ok, FOTOAI_SUPABASE_URL: '  https://db.example.com//  ' });
  expect(env.FOTOAI_SUPABASE_URL).toBe('https://db.example.com');
});

test('rejects a non-http(s) URL', () => {
  expect(() => createServerEnv({ ...ok, FOTOAI_SUPABASE_URL: 'ftp://db.example.com' })).toThrow(/FOTOAI_SUPABASE_URL/);
});

test('cookie Secure defaults to true in production and false in development', () => {
  expect(createServerEnv(ok).FOTOAI_COOKIE_SECURE).toBe(true);
  expect(createServerEnv({ ...ok, NODE_ENV: 'development' }).FOTOAI_COOKIE_SECURE).toBe(false);
  expect(createServerEnv({ ...ok, FOTOAI_COOKIE_SECURE: 'false' }).FOTOAI_COOKIE_SECURE).toBe(false);
});

test('treats empty strings as missing', () => {
  expect(() => createServerEnv({ ...ok, FOTOAI_SUPABASE_ANON_KEY: '' })).toThrow(/FOTOAI_SUPABASE_ANON_KEY/);
});

test('error message names variables but never values', () => {
  let message = '';
  try {
    createServerEnv({ ...ok, FOTOAI_SUPABASE_URL: 'sk-live-SECRET123' });
  } catch (e) {
    message = String(e);
  }
  expect(message).toMatch(/FOTOAI_SUPABASE_URL/);
  expect(message).not.toContain('sk-live-SECRET123');
});

test('the Google Maps server key is optional, trimmed, and empty means not set', () => {
  expect(createServerEnv(ok).GOOGLE_MAPS_SERVER_API_KEY).toBeUndefined();
  expect(createServerEnv({ ...ok, GOOGLE_MAPS_SERVER_API_KEY: '' }).GOOGLE_MAPS_SERVER_API_KEY).toBeUndefined();
  expect(createServerEnv({ ...ok, GOOGLE_MAPS_SERVER_API_KEY: '  AIzaTEST  ' }).GOOGLE_MAPS_SERVER_API_KEY).toBe('AIzaTEST');
});

test('the OpenAI key and model are optional; the model defaults to gpt-6-luna', () => {
  expect(createServerEnv(ok)).toMatchObject({ OPENAI_API_KEY: undefined, FOTOAI_AI_MODEL: 'gpt-6-luna' });
  expect(createServerEnv({ ...ok, OPENAI_API_KEY: '' }).OPENAI_API_KEY).toBeUndefined();
  expect(createServerEnv({ ...ok, OPENAI_API_KEY: ' sk-test ', FOTOAI_AI_MODEL: 'gpt-5-nano' })).toMatchObject({
    OPENAI_API_KEY: 'sk-test',
    FOTOAI_AI_MODEL: 'gpt-5-nano',
  });
});
