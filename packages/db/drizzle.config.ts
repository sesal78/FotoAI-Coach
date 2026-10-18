// Drizzle is schema-as-code and migration generation only; runtime access goes through
// supabase-js so RLS applies. Pull and generate run against the LOCAL Postgres only.
import { defineConfig } from 'drizzle-kit';

const url = process.env.FOTOAI_TEST_DATABASE_URL ?? '';
if (!/^postgres(ql)?:\/\/[^@/\s]+@(127\.0\.0\.1|localhost):\d{2,5}\/[\w-]+$/.test(url)) {
  throw new Error('drizzle-kit here only talks to a local Postgres: set FOTOAI_TEST_DATABASE_URL (127.0.0.1 or localhost)');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/schema.ts',
  out: process.env.DRIZZLE_OUT ?? './drizzle',
  schemaFilter: ['public'],
  tablesFilter: ['fotoai_*'],
  dbCredentials: { url },
});
