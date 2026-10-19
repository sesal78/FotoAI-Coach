// Server environment for the FotoAI API. Validated once at boot; never read
// process.env for these names anywhere else. Errors name variables, never values.

import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export interface ServerEnv {
  FOTOAI_SUPABASE_URL: string;
  FOTOAI_SUPABASE_ANON_KEY: string;
  FOTOAI_SUPABASE_SERVICE_ROLE_KEY: string;
  FOTOAI_COOKIE_SECURE: boolean;
  /** Server key for Google Places (New). Optional: without it the Places endpoints answer 500 config. */
  GOOGLE_MAPS_SERVER_API_KEY?: string;
  /** OpenAI key (the live app's existing variable). Optional: without it the AI endpoints answer 500 config. */
  OPENAI_API_KEY?: string;
  /** OpenAI model id for the v2 AI layer. */
  FOTOAI_AI_MODEL: string;
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
      GOOGLE_MAPS_SERVER_API_KEY: trimmed.optional(),
      OPENAI_API_KEY: trimmed.optional(),
      FOTOAI_AI_MODEL: trimmed.default('gpt-6-luna'),
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
    GOOGLE_MAPS_SERVER_API_KEY: env.GOOGLE_MAPS_SERVER_API_KEY,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    FOTOAI_AI_MODEL: env.FOTOAI_AI_MODEL,
    NODE_ENV: env.NODE_ENV,
  };
}
