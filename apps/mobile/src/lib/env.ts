// The app's public config. Expo inlines EXPO_PUBLIC_* values at build time, and only when each
// is read as a literal `process.env.NAME`, so `appEnv` names them one by one. Nothing secret
// belongs here: anyone can read these values out of the APK.

import { z } from 'zod';

const httpsUrl = z.string().url().refine((v) => v.startsWith('https://'), 'must be https');

const Env = z.object({
  EXPO_PUBLIC_API_URL: httpsUrl,
  EXPO_PUBLIC_SUPABASE_URL: httpsUrl,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  EXPO_PUBLIC_SENTRY_DSN: httpsUrl.optional(),
});

export type AppEnv = z.infer<typeof Env>;

/** Checks the values; a problem names the variable only, never its value. */
export function readEnv(source: Record<keyof AppEnv, string | undefined>): { ok: true; env: AppEnv } | { ok: false; problems: string[] } {
  const parsed = Env.safeParse({ ...source, EXPO_PUBLIC_SENTRY_DSN: source.EXPO_PUBLIC_SENTRY_DSN || undefined });
  if (parsed.success) return { ok: true, env: parsed.data };
  return { ok: false, problems: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))] };
}

export const appEnv = readEnv({
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
});
