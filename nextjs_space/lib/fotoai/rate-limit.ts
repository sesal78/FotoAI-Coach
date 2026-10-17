// Per-user rate limits for the FotoAI LLM routes.
//
// No new table and no new dependency: every admitted LLM call appends one
// fotoai_agent_actions row (action_type LLM_REQUEST_<ROUTE>) with the user
// token, and the limit counts the caller's own rows of that route inside the
// window (RLS + an explicit user_id filter). Reserve-first, like the portfolio
// limit: a cheap count refuses at the limit without writing; otherwise the
// row is inserted and the count is taken again, so parallel requests cannot
// all pass. Users have no UPDATE/DELETE on agent actions, so a request that
// loses that race keeps its row; it counts until it leaves the window.
// Only equality filters are used; the window is applied to the newest rows.

import { FotoaiRateLimitError } from './errors.ts';
import { requireUuid } from './object-keys.ts';
import type { OwnerScope } from './repository.ts';
import type { FotoaiSupabaseClient } from './supabase-http.ts';

const T_AGENT_ACTIONS = 'fotoai_agent_actions';

export const LLM_RATE_WINDOW_MS = 60 * 60 * 1000;

/** Admitted LLM calls per user per LLM_RATE_WINDOW_MS. Generous on purpose. */
export const LLM_RATE_LIMITS = {
  challenge_generate: 20,
  chat: 120,
  critique: 30,
  reverse: 30,
  editing: 20,
  itinerary: 20,
  locations: 30,
} as const;

export type LlmRoute = keyof typeof LLM_RATE_LIMITS;

export function llmActionType(route: LlmRoute): string {
  return `LLM_REQUEST_${route.toUpperCase()}`;
}

async function countRecent(
  client: FotoaiSupabaseClient, scope: OwnerScope, route: LlmRoute, since: number, max: number,
): Promise<number> {
  const rows = await client.restSelect<{ executed_at: string }>(T_AGENT_ACTIONS, {
    user_id: `eq.${requireUuid(scope.userId, 'session user id')}`,
    action_type: `eq.${llmActionType(route)}`,
    select: 'executed_at',
    order: 'executed_at.desc',
    limit: String(max),
  }, scope.accessToken);
  return rows.filter((row) => Date.parse(row.executed_at) >= since).length;
}

/**
 * Admits one LLM call for the session user or throws FotoaiRateLimitError
 * (429). Call it after input validation and before the LLM call.
 */
export async function reserveLlmCall(
  client: FotoaiSupabaseClient, scope: OwnerScope, route: LlmRoute, now = new Date(),
): Promise<void> {
  const max = LLM_RATE_LIMITS[route];
  const since = now.getTime() - LLM_RATE_WINDOW_MS;
  const refuse = () => new FotoaiRateLimitError(
    `Rate limit: at most ${max} ${route.replace('_', ' ')} requests per hour. Please try again later.`,
  );

  if (await countRecent(client, scope, route, since, max) >= max) throw refuse();
  await client.restInsert(T_AGENT_ACTIONS, {
    user_id: requireUuid(scope.userId, 'session user id'),
    action_type: llmActionType(route),
    details: { route },
    success: true,
    executed_at: now.toISOString(),
  }, scope.accessToken);
  // Our own row is included: more than the limit means a parallel request won.
  if (await countRecent(client, scope, route, since, max + 1) > max) throw refuse();
}
