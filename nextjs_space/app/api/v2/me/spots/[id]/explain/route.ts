import { defaultV2Deps, defineV2Handler, explainSpot } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/me/spots/:id/explain - best light and angles for one of the caller's spots; not stored. */
export const GET = defineV2Handler(defaultV2Deps, explainSpot);
