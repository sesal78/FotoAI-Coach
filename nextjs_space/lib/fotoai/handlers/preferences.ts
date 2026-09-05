import { assertNoBrowserIdentity } from '../membership.ts';
import { type DepsProvider, json, readJsonBody, requirePrincipal, withFotoai } from './shared.ts';

export function createPreferencesHandlers(provider: DepsProvider) {
  return {
    /** GET /api/fotoai/preferences */
    get: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      return json({ preferences: await deps.repo.getPreferences(principal) });
    }),

    /** PUT /api/fotoai/preferences */
    put: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const body = await readJsonBody(request);
      assertNoBrowserIdentity(body);
      return json({ preferences: await deps.repo.savePreferences(principal, body) });
    }),
  };
}
