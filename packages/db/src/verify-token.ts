// Verifies a Supabase access token by asking Supabase Auth who it belongs to. An invalid,
// expired or revoked token (any 4xx from Auth) is null; an outage throws, so callers answer
// 5xx instead of treating an unreachable Auth server as "logged out".

import { createClient } from '@supabase/supabase-js';
import type { ServerEnv } from '@fotoai/env';

import type { Database } from './types.gen.ts';
import { NO_SESSION_AUTH } from './user-client.ts';

export type TokenVerifier = (token: string) => Promise<{ userId: string; email: string | null } | null>;

export function createTokenVerifier(
  env: Pick<ServerEnv, 'FOTOAI_SUPABASE_URL' | 'FOTOAI_SUPABASE_ANON_KEY'>,
  options: { fetch?: typeof fetch } = {},
): TokenVerifier {
  const client = createClient<Database>(env.FOTOAI_SUPABASE_URL, env.FOTOAI_SUPABASE_ANON_KEY, {
    auth: NO_SESSION_AUTH,
    ...(options.fetch ? { global: { fetch: options.fetch } } : {}),
  });
  return async (token) => {
    const { data, error } = await client.auth.getUser(token);
    if (error) {
      const status = (error as { status?: number }).status ?? 0;
      if (status >= 400 && status < 500) return null;
      throw new Error(`Supabase Auth could not verify the token (status ${status || 'none'})`);
    }
    if (!data.user) return null;
    return { userId: data.user.id, email: data.user.email ?? null };
  };
}
