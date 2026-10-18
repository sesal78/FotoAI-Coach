import { defaultV2Deps, defineV2Handler, json, rejectBrowserIdentity, requirePrincipal } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/me - who the bearer token (or session cookie) belongs to. */
export const GET = defineV2Handler(defaultV2Deps, async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  return json({ userId: principal.userId, email: principal.email });
});
