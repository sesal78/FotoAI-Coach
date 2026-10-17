// Next.js-side wiring for FotoAI Supabase routes. Import ONLY from route files
// under app/api/fotoai/. Everything else in lib/fotoai is framework-free.

import * as email from '../email.ts';
import * as llm from '../llm.ts';
import * as weather from '../weather.ts';
import { readFotoaiEnv } from './env.ts';
import type { FotoaiDeps } from './handlers/shared.ts';
import { defaultLog } from './handlers/shared.ts';
import { createPhotoService } from './photos.ts';
import { createFotoaiRepository } from './repository.ts';
import { createFotoaiSupabaseClient } from './supabase-http.ts';
import { createXpService } from './xp.ts';

let cached: FotoaiDeps | null = null;

/** Builds (once per process) the dependency set used by every FotoAI route. */
export function getFotoaiDeps(): FotoaiDeps {
  if (cached) return cached;
  const env = readFotoaiEnv();
  const client = createFotoaiSupabaseClient(env);
  const repo = createFotoaiRepository(client);
  const photos = createPhotoService(client, env, repo);
  const xp = createXpService(client);
  cached = { env, client, repo, photos, xp, services: { ai: llm, weather, mail: email }, log: defaultLog };
  return cached;
}
