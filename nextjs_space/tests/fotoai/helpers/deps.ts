// Builds a full FotoAI dependency set on top of the fake Supabase client.

import type { FotoaiEnv } from '../../../lib/fotoai/env.ts';
import type { FotoaiDeps } from '../../../lib/fotoai/handlers/shared.ts';
import { createPhotoService } from '../../../lib/fotoai/photos.ts';
import { createFotoaiRepository } from '../../../lib/fotoai/repository.ts';
import type { FotoaiServices } from '../../../lib/fotoai/services.ts';
import { createXpService } from '../../../lib/fotoai/xp.ts';
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
  /** Every outside-service call: name plus the arguments passed. */
  calls: Array<{ name: string; args: unknown[] }>;
  /** What each fake service returns: name -> function. Unset means the call throws. */
  fakes: Record<string, (...args: any[]) => unknown>;
}

const SERVICE_NAMES = {
  ai: ['callLLM', 'generateChallenge', 'generateFeedback', 'critiquePhoto', 'reverseEngineerPhoto',
    'generateEditingRecipe', 'generateWeeklyInsights', 'assessPortfolioPhoto', 'analyzePortfolioMeta', 'generateItinerary'],
  weather: ['getWeather'],
  mail: ['sendChallengeEmail', 'sendWeeklyReport', 'sendWeatherAlert'],
};

/** Fake LLM, weather and email. Each call is recorded; results come from `fakes`. */
function createFakeServices(calls: TestDeps['calls'], fakes: TestDeps['fakes']): FotoaiServices {
  const run = (name: string, args: unknown[]) => {
    calls.push({ name, args });
    if (!fakes[name]) throw new Error(`fake service ${name} has no result; set deps.fakes.${name}`);
    return fakes[name](...args);
  };
  const group = (list: string[]) => Object.fromEntries(list.map((n) => [n, async (...args: unknown[]) => run(n, args)]));
  const services: any = { ai: group(SERVICE_NAMES.ai), weather: group(SERVICE_NAMES.weather), mail: group(SERVICE_NAMES.mail) };
  // Synchronous in lib/weather.ts.
  services.weather.analyzeWeatherForPhotography = (...args: unknown[]) => run('analyzeWeatherForPhotography', args);
  return services as FotoaiServices;
}

export function createTestDeps(): TestDeps {
  const client = createFakeSupabase();
  const repo = createFotoaiRepository(client);
  const photos = createPhotoService(client, TEST_ENV, repo);
  const logs: TestDeps['logs'] = [];
  const calls: TestDeps['calls'] = [];
  const fakes: TestDeps['fakes'] = {};
  return {
    env: TEST_ENV,
    client,
    repo,
    photos,
    xp: createXpService(client),
    services: createFakeServices(calls, fakes),
    calls,
    fakes,
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
