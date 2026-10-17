import { FotoaiValidationError } from '../errors.ts';
import { assertNoBrowserIdentity } from '../membership.ts';
import type { PreferenceView } from '../repository.ts';
import { type DepsProvider, json, readJsonBody, requirePrincipal, withFotoai } from './shared.ts';

/**
 * `?view=full` opts in to every editable column. Without it the endpoint keeps
 * its original four-field contract (skillLevel, photographyInterests,
 * homeLocation, currentLocation) so existing callers are unchanged.
 */
function readView(params: URLSearchParams): PreferenceView {
  const values = params.getAll('view');
  if (values.length === 0) return 'basic';
  if (values.length === 1 && values[0] === 'full') return 'full';
  throw new FotoaiValidationError('view must be "full" when given');
}

export function createPreferencesHandlers(provider: DepsProvider) {
  return {
    /** GET /api/fotoai/preferences[?view=full] */
    get: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      const params = new URL(request.url).searchParams;
      assertNoBrowserIdentity(params);
      const view = readView(params);
      return json({ preferences: await deps.repo.getPreferences(principal, view) });
    }),

    /** PUT /api/fotoai/preferences[?view=full] */
    put: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      const params = new URL(request.url).searchParams;
      assertNoBrowserIdentity(params);
      const view = readView(params);
      const body = await readJsonBody(request);
      assertNoBrowserIdentity(body);
      return json({ preferences: await deps.repo.savePreferences(principal, body, view) });
    }),
  };
}
