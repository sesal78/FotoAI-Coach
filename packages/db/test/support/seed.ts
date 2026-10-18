// Test-only helpers for integration suites in other packages (they may not import the
// service client themselves: lint restricts @fotoai/db/service to packages/db and privileged/).
// Local Supabase only: every caller gets `db` from resolveDb / localDbFromEnv.

import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

import { createServiceClient } from '../../src/service-client.ts';
import type { LocalDb } from './local-db.ts';

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

export function testEnv(db: LocalDb) {
  return {
    FOTOAI_SUPABASE_URL: db.url,
    FOTOAI_SUPABASE_ANON_KEY: db.anonKey,
    FOTOAI_SUPABASE_SERVICE_ROLE_KEY: db.serviceRoleKey,
    FOTOAI_COOKIE_SECURE: false,
    NODE_ENV: 'test' as const,
  };
}

/** A confirmed throwaway user, signed in; delete it with deleteTestUsers. */
export async function createTestUser(db: LocalDb, prefix: string): Promise<TestUser> {
  const service = createServiceClient(testEnv(db));
  const email = `${prefix}-${randomUUID()}@localhost.test`;
  const password = randomBytes(18).toString('base64url');
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(`createUser failed: ${created.error?.message}`);
  const anon = createClient(db.url, db.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await anon.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) throw new Error(`signIn failed: ${signIn.error?.message}`);
  return { id: created.data.user.id, email, token: signIn.data.session.access_token };
}

export async function deleteTestUsers(db: LocalDb, users: Array<TestUser | undefined>): Promise<void> {
  const service = createServiceClient(testEnv(db));
  for (const user of users) if (user) await service.auth.admin.deleteUser(user.id);
}

/** Inserts rows with the service role (bypasses RLS) and returns them. */
export async function seedRows(db: LocalDb, table: string, rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  const service = createServiceClient(testEnv(db)) as unknown as {
    from: (t: string) => { insert: (r: Record<string, unknown>[], o: { defaultToNull: boolean }) => { select: () => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> } };
  };
  // defaultToNull: false lets rows with different keys keep each column's default.
  const { data, error } = await service.from(table).insert(rows, { defaultToNull: false }).select();
  if (error || !data) throw new Error(`seed ${table} failed: ${error?.message}`);
  return data;
}
