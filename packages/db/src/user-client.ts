// User-scoped Supabase client: anon key + the user's own access token, so RLS applies.
// One client per request; it never stores or refreshes a session (the caller owns that).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ServerEnv } from '@fotoai/env';

import type { Database } from './types.gen.ts';

export const NO_SESSION_AUTH = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } as const;

export function createUserClient(
  env: Pick<ServerEnv, 'FOTOAI_SUPABASE_URL' | 'FOTOAI_SUPABASE_ANON_KEY'>,
  accessToken: string,
  options: { fetch?: typeof fetch } = {},
): SupabaseClient<Database> {
  if (!accessToken.trim()) throw new Error('createUserClient needs the user access token');
  return createClient<Database>(env.FOTOAI_SUPABASE_URL, env.FOTOAI_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` }, ...(options.fetch ? { fetch: options.fetch } : {}) },
    auth: NO_SESSION_AUTH,
  });
}
