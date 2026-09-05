// FotoAI Supabase configuration. Read once through this module; never touch
// process.env for FotoAI values anywhere else.
//
// All names are new and prefixed FOTOAI_ so they can live next to the Appwrite
// variables during the rollback window. See .env.example.

import { FotoaiConfigError } from './errors.ts';

export const FOTOAI_BUCKET = 'fotoai-submissions' as const;

export interface FotoaiEnv {
  /** Supabase API gateway base URL (Kong), e.g. https://supabase.example.com */
  supabaseUrl: string;
  /** Public anon key. Sent as `apikey` with the user's own bearer token. */
  anonKey: string;
  /** Service role key. Server only. Used for signed URLs, deletes, XP awards. */
  serviceRoleKey: string;
  /** Storage bucket for submission photos. Fixed name. */
  bucket: typeof FOTOAI_BUCKET;
  /** Set the Secure flag on session cookies (true outside local dev). */
  cookieSecure: boolean;
}

type EnvSource = Record<string, string | undefined>;

export function readFotoaiEnv(source: EnvSource = process.env): FotoaiEnv {
  const required = [
    'FOTOAI_SUPABASE_URL',
    'FOTOAI_SUPABASE_ANON_KEY',
    'FOTOAI_SUPABASE_SERVICE_ROLE_KEY',
  ] as const;

  const missing = required.filter((name) => !source[name] || source[name]!.trim() === '');
  if (missing.length > 0) {
    // Names only. Never log values.
    throw new FotoaiConfigError(`FotoAI Supabase config missing: ${missing.join(', ')}`);
  }

  const supabaseUrl = source.FOTOAI_SUPABASE_URL!.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/[^\s/]+/.test(supabaseUrl)) {
    throw new FotoaiConfigError('FOTOAI_SUPABASE_URL must be an absolute http(s) URL');
  }

  const cookieSecure = source.FOTOAI_COOKIE_SECURE !== undefined
    ? source.FOTOAI_COOKIE_SECURE === 'true'
    : source.NODE_ENV === 'production';

  return {
    supabaseUrl,
    anonKey: source.FOTOAI_SUPABASE_ANON_KEY!.trim(),
    serviceRoleKey: source.FOTOAI_SUPABASE_SERVICE_ROLE_KEY!.trim(),
    bucket: FOTOAI_BUCKET,
    cookieSecure,
  };
}
