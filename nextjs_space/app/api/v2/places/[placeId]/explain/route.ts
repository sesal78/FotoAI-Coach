import { defaultV2Deps, defineV2Handler, explainGooglePlace } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/places/:placeId/explain - best light and angles from the Places facts only; not stored. */
export const GET = defineV2Handler(defaultV2Deps, explainGooglePlace);
