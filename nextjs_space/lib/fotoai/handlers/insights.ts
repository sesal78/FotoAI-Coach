// FotoAI weekly insights handler (owner-scoped, read-only).
//
//   GET /api/fotoai/insights?limit=   own weekly reports, newest first
//
// Identity: session cookie only. Any userId in the request is rejected (400).

import { assertNoBrowserIdentity } from '../membership.ts';
import { createInsightsRepo, DEFAULT_REPORT_LIMIT, MAX_REPORT_LIMIT, parseListLimit } from '../repo-insights.ts';
import { type DepsProvider, json, requirePrincipal, withFotoai } from './shared.ts';

export function createInsightsHandlers(provider: DepsProvider) {
  return {
    list: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      const params = new URL(request.url).searchParams;
      assertNoBrowserIdentity(params);
      const limit = parseListLimit(params.get('limit'), DEFAULT_REPORT_LIMIT, MAX_REPORT_LIMIT);
      const reports = await createInsightsRepo(deps.client).listWeeklyReports(principal, { limit });
      return json({ reports });
    }),
  };
}
