import { defineConfig } from 'vitest/config';

// Real-Postgres tests against the LOCAL Supabase stack only (see test/support/local-db.ts).
export default defineConfig({ test: { include: ['test/**/*.integration.test.ts'], testTimeout: 30_000 } });
