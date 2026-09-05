// FotoAI progress handler (owner-scoped).
//   GET /api/fotoai/progress

import { assertNoBrowserIdentity } from '../membership.ts';
import { type DepsProvider, json, requirePrincipal, withFotoai } from './shared.ts';

export function createProgressHandlers(provider: DepsProvider) {
  return {
    get: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);

      const progress = await deps.repo.getOrCreateProgress(principal);
      const recentSubmissions = await deps.repo.listSubmissions(principal, { limit: 10 });

      const totalIssued = progress.total_challenges_issued || 0;
      const totalCompleted = progress.total_challenges_completed || 0;
      const completionRate = totalIssued > 0 ? Math.round((totalCompleted / totalIssued) * 100) : 0;

      return json({
        progress: {
          ...progress,
          completionRate,
          recentSubmissions: recentSubmissions.slice(0, 5),
        },
      });
    }),
  };
}
