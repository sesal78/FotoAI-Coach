import { defaultV2Deps, defineV2Handler, getPlace } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/places/:placeId - details, light, weather and the caller's saved spot. */
export const GET = defineV2Handler(defaultV2Deps, getPlace);
