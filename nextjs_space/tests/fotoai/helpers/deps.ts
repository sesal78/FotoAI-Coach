// Builds a full FotoAI dependency set on top of the fake Supabase client.

import type { FotoaiEnv } from '../../../lib/fotoai/env.ts';
import type { FotoaiDeps } from '../../../lib/fotoai/handlers/shared.ts';
import { createPhotoService } from '../../../lib/fotoai/photos.ts';
import { createFotoaiRepository } from '../../../lib/fotoai/repository.ts';
import { createFakeSupabase, type FakeSupabase } from './fake-supabase.ts';

export const TEST_ENV: FotoaiEnv = {
  supabaseUrl: 'https://supabase.test.invalid',
  anonKey: 'anon-test',
  serviceRoleKey: 'service-test',
  bucket: 'fotoai-submissions',
  cookieSecure: false,
};

export interface TestDeps extends FotoaiDeps {
  client: FakeSupabase;
  logs: Array<{ level: string; message: string }>;
}

export function createTestDeps(): TestDeps {
  const client = createFakeSupabase();
  const repo = createFotoaiRepository(client);
  const photos = createPhotoService(client, TEST_ENV, repo);
  const logs: TestDeps['logs'] = [];
  return {
    env: TEST_ENV,
    client,
    repo,
    photos,
    logs,
    log: (level, message) => { logs.push({ level, message }); },
  };
}

export function cookieFor(token: string): string {
  return `fotoai_session=${token}`;
}

export function request(url: string, init: RequestInit & { cookie?: string } = {}): Request {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set('cookie', init.cookie);
  return new Request(`http://localhost${url}`, { ...init, headers });
}

export function jsonRequest(url: string, body: unknown, init: { cookie?: string; method?: string } = {}): Request {
  return request(url, {
    method: init.method ?? 'POST',
    cookie: init.cookie,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
