// Per-user hourly limits for the paid Google calls. The same reserve-first pattern as the live
// app's LLM limits (nextjs_space/lib/fotoai/rate-limit.ts), on the same table: every admitted
// call appends one fotoai_agent_actions row with the user's token, and the limit counts the
// caller's own rows of that route in the last hour. A cheap count refuses without writing;
// otherwise the rows are inserted and the count is taken again, so parallel requests cannot
// all pass. Users cannot delete agent actions, so a request that loses that race keeps its
// rows; they count until they leave the window.

import { createUserClient } from '@fotoai/db';
import type { ServerEnv } from '@fotoai/env';

import type { Principal } from './auth.ts';
import { ApiError } from './handler.ts';

export const V2_RATE_WINDOW_MS = 60 * 60 * 1000;

/** Admitted calls per user per hour. Photos are lower: only 1,000 are free a month. */
export const V2_RATE_LIMITS = { places: 120, place_photos: 30, plan_generate: 20, place_explain: 60 } as const;

export type V2RateRoute = keyof typeof V2_RATE_LIMITS;

const T_AGENT_ACTIONS = 'fotoai_agent_actions';
const actionType = (route: V2RateRoute) => `API_REQUEST_${route.toUpperCase()}`;

async function countRecent(env: ServerEnv, principal: Principal, route: V2RateRoute, since: Date): Promise<number> {
  const { count, error } = await createUserClient(env, principal.accessToken)
    .from(T_AGENT_ACTIONS)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', principal.userId)
    .eq('action_type', actionType(route))
    .gte('executed_at', since.toISOString());
  if (error || count === null) throw new ApiError('upstream', 'Could not check the rate limit');
  return count;
}

/** Admits `count` calls for the session user, or throws 429 rate_limited. Call it after input checks. */
export async function reserveCalls(env: ServerEnv, principal: Principal, route: V2RateRoute, count = 1, now = new Date()): Promise<void> {
  const max = V2_RATE_LIMITS[route];
  const since = new Date(now.getTime() - V2_RATE_WINDOW_MS);
  const refuse = () => new ApiError('rate_limited', `Rate limit: at most ${max} ${route.replace('_', ' ')} requests per hour. Please try again later.`);
  if (count < 1) return;

  if ((await countRecent(env, principal, route, since)) + count > max) throw refuse();
  const rows = Array.from({ length: count }, () => ({
    user_id: principal.userId,
    action_type: actionType(route),
    details: { route },
    success: true,
    executed_at: now.toISOString(),
  }));
  const { error } = await createUserClient(env, principal.accessToken).from(T_AGENT_ACTIONS).insert(rows as never);
  if (error) throw new ApiError('upstream', 'Could not record the request');
  // Our own rows are included: more than the limit means a parallel request won.
  if ((await countRecent(env, principal, route, since)) > max) throw refuse();
}
