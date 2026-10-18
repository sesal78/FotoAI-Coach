// Server environment for the FotoAI API. Validated once at boot; never read
// process.env for these names anywhere else. Errors name variables, never values.

import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export interface ServerEnv {
  FOTOAI_SUPABASE_URL: string;
  FOTOAI_SUPABASE_ANON_KEY: string;
  FOTOAI_SUPABASE_SERVICE_ROLE_KEY: string;
  FOTOAI_COOKIE_SECURE: boolean;
  NODE_ENV: 'development' | 'test' | 'production';
}

type EnvSource = Record<string, string | undefined>;

const trimmed = z.string().trim().min(1);

const supabaseUrl = trimmed
  .transform((value) => value.replace(/\/+$/, ''))
  .pipe(z.string().url().regex(/^https?:\/\//));

export function createServerEnv(source: EnvSource = process.env): ServerEnv {
  const env = createEnv({
    server: {
      FOTOAI_SUPABASE_URL: supabaseUrl,
      FOTOAI_SUPABASE_ANON_KEY: trimmed,
      FOTOAI_SUPABASE_SERVICE_ROLE_KEY: trimmed,
      FOTOAI_COOKIE_SECURE: z.enum(['true', 'false']).optional(),
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    },
    runtimeEnv: source,
    emptyStringAsUndefined: true,
    isServer: true,
    onValidationError: (issues) => {
      const names = issues.map((issue) => issue.path?.map(String).join('.') ?? '(unknown)');
      throw new Error(`FotoAI env invalid: ${[...new Set(names)].join(', ')}`);
    },
  });

  const cookieSecure =
    env.FOTOAI_COOKIE_SECURE === undefined ? env.NODE_ENV === 'production' : env.FOTOAI_COOKIE_SECURE === 'true';

  return {
    FOTOAI_SUPABASE_URL: env.FOTOAI_SUPABASE_URL,
    FOTOAI_SUPABASE_ANON_KEY: env.FOTOAI_SUPABASE_ANON_KEY,
    FOTOAI_SUPABASE_SERVICE_ROLE_KEY: env.FOTOAI_SUPABASE_SERVICE_ROLE_KEY,
    FOTOAI_COOKIE_SECURE: cookieSecure,
    NODE_ENV: env.NODE_ENV,
  };
}
