// Seeds a new account's preferences and progress rows, like the legacy
// Appwrite register route did. Runs with the USER token (RLS applies) once a
// session exists: after sign-up confirmation, or at register when Auth returns
// a session straight away. Existing rows are never overwritten.

import { FotoaiUpstreamError } from './errors.ts';
import { requireUuid } from './object-keys.ts';
import { PREFERENCE_SEED_ROW, type OwnerScope } from './repository.ts';
import type { FotoaiSupabaseClient } from './supabase-http.ts';

const T_PREFERENCES = 'fotoai_user_preferences';
const T_PROGRESS = 'fotoai_user_progress';

/** PostgREST answers 409 on a unique violation: a parallel request created the row first. */
function isConflict(err: unknown): boolean {
  return err instanceof FotoaiUpstreamError && err.upstreamStatus === 409;
}

export function createAccountSeedRepo(client: FotoaiSupabaseClient) {
  async function insertIfMissing(table: string, scope: OwnerScope, row: Record<string, unknown>): Promise<boolean> {
    const userId = requireUuid(scope.userId, 'session user id');
    const existing = await client.restSelect(table, { user_id: `eq.${userId}`, select: 'id', limit: '1' }, scope.accessToken);
    if (existing.length > 0) return false;
    try {
      await client.restInsert(table, { ...row, user_id: userId }, scope.accessToken);
      return true;
    } catch (err) {
      if (isConflict(err)) return false;
      throw err;
    }
  }

  return {
    /** Returns which rows were created. Safe to call more than once. */
    async ensureAccountDefaults(scope: OwnerScope): Promise<{ preferences: boolean; progress: boolean }> {
      const preferences = await insertIfMissing(T_PREFERENCES, scope, PREFERENCE_SEED_ROW);
      const progress = await insertIfMissing(T_PROGRESS, scope, {});
      return { preferences, progress };
    },
  };
}
