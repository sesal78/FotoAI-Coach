// FotoAI skill tree handler (owner-scoped).
//
//   GET /api/fotoai/skills   skill tree, XP and level of the session user
//
// Identity: session cookie only. Any userId in the request is rejected (400).

import { assertNoBrowserIdentity } from '../membership.ts';
import { type DepsProvider, json, requirePrincipal, withFotoai } from './shared.ts';

export function createSkillsHandlers(provider: DepsProvider) {
  return {
    get: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      return json(await deps.xp.getSkillTree(principal));
    }),
  };
}
