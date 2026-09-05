// FotoAI challenge handlers (owner-scoped, read + status update).
//
//   GET   /api/fotoai/challenges?status=&limit=   list own challenges
//   GET   /api/fotoai/challenges/[id]             read own challenge (+submissions)
//   PATCH /api/fotoai/challenges/[id]  {status}   update own challenge status
//
// Not ported on purpose: the Appwrite route's `?latest=true` path, which
// returned the newest challenge of ANY user without authentication.
// Challenge generation (LLM + weather) stays on the Appwrite route until the
// generation pipeline is migrated in a later step.

import { FotoaiValidationError } from '../errors.ts';
import { assertNoBrowserIdentity } from '../membership.ts';
import type { ChallengeStatusFilter } from '../repository.ts';
import { type DepsProvider, json, readJsonBody, requirePrincipal, withFotoai } from './shared.ts';

export function createChallengeHandlers(provider: DepsProvider) {
  return {
    list: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      const params = new URL(request.url).searchParams;
      assertNoBrowserIdentity(params);
      const challenges = await deps.repo.listChallenges(principal, {
        status: (params.get('status') as ChallengeStatusFilter | null) ?? undefined,
        limit: params.has('limit') ? Number(params.get('limit')) : undefined,
      });
      return json({ challenges });
    }),

    get: withFotoai(provider, async (request, deps, { params }) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const challenge = await deps.repo.getChallenge(principal, params.id);
      const submissions = await deps.repo.listSubmissions(principal, { challengeId: challenge.id });
      return json({ challenge: { ...challenge, submissions } });
    }),

    patch: withFotoai(provider, async (request, deps, { params }) => {
      const principal = await requirePrincipal(request, deps);
      const body = await readJsonBody(request);
      assertNoBrowserIdentity(body);
      const status = body.status;
      if (typeof status !== 'string' || !['pending', 'accepted', 'skipped', 'completed'].includes(status)) {
        throw new FotoaiValidationError('Invalid status');
      }
      const challenge = await deps.repo.updateChallengeStatus(principal, params.id, status as any);
      if (status === 'completed') {
        await deps.repo.recordCompletion(principal, challenge);
      }
      return json({ challenge, message: 'Challenge updated' });
    }),
  };
}
