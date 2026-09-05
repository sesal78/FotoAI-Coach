import { assertNoBrowserIdentity } from '../membership.ts';
import { requireUuid } from '../object-keys.ts';
import { type DepsProvider, json, readJsonBody, requirePrincipal, withFotoai } from './shared.ts';

export function createGearHandlers(provider: DepsProvider) {
  return {
    /** GET /api/fotoai/gear */
    list: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      return json({ gear: await deps.repo.listGear(principal) });
    }),

    /** POST /api/fotoai/gear */
    create: withFotoai(provider, async (request, deps) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const body = await readJsonBody(request);
      assertNoBrowserIdentity(body);
      return json({ gear: await deps.repo.createGear(principal, body) }, { status: 201 });
    }),

    /** DELETE /api/fotoai/gear/[id] */
    remove: withFotoai(provider, async (request, deps, context) => {
      const principal = await requirePrincipal(request, deps);
      assertNoBrowserIdentity(new URL(request.url).searchParams);
      const id = requireUuid(context.params.id, 'gear id');
      await deps.repo.deleteGear(principal, id);
      return json({ success: true });
    }),
  };
}
