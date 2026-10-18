// Integration tests run against the LOCAL Supabase stack only. Anything else is refused
// before a single request is sent. In CI, FOTOAI_REQUIRE_DB_TESTS=1 turns a missing
// variable into a failure instead of a silent skip.

type Source = Record<string, string | undefined>;

export interface LocalDb {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

const LOCAL_HTTP = /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/;

export function assertLocal(url: string): void {
  if (!LOCAL_HTTP.test(url.replace(/\/+$/, ''))) {
    throw new Error('Integration tests only run against a local Supabase (http://127.0.0.1:<port> or http://localhost:<port>)');
  }
}

export function resolveDb(source: Source): LocalDb | null {
  const names = ['FOTOAI_TEST_SUPABASE_URL', 'FOTOAI_TEST_SUPABASE_ANON_KEY', 'FOTOAI_TEST_SUPABASE_SERVICE_ROLE_KEY'] as const;
  const missing = names.filter((name) => !source[name]?.trim());
  if (missing.length > 0) {
    if (source.FOTOAI_REQUIRE_DB_TESTS === '1') throw new Error(`Database tests required but missing: ${missing.join(', ')}`);
    return null;
  }
  const url = source.FOTOAI_TEST_SUPABASE_URL!.trim().replace(/\/+$/, '');
  assertLocal(url);
  return { url, anonKey: source.FOTOAI_TEST_SUPABASE_ANON_KEY!.trim(), serviceRoleKey: source.FOTOAI_TEST_SUPABASE_SERVICE_ROLE_KEY!.trim() };
}

export function localDbFromEnv(): LocalDb | null {
  return resolveDb(process.env);
}
