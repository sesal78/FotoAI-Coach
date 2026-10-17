// Owner-scope helpers shared by repo-reverse.ts, repo-editing.ts and repo-portfolio.ts.
// Same rules as repository.ts: the session user id filters every read and is
// written into every insert; the user token is forwarded so RLS applies too.

import { requireUuid } from './object-keys.ts';
import type { OwnerScope } from './repository.ts';

export function ownerFilter(scope: OwnerScope): Record<string, string> {
  return { user_id: `eq.${requireUuid(scope.userId, 'session user id')}` };
}

export function ownerId(scope: OwnerScope): string {
  return requireUuid(scope.userId, 'session user id');
}

export function boundedLimit(limit: number | undefined, fallback: number, max: number): string {
  const n = Number.isFinite(limit) && (limit as number) > 0 ? Math.floor(limit as number) : fallback;
  return String(Math.min(n, max));
}

/** jsonb result columns must be plain objects. */
export function asJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
