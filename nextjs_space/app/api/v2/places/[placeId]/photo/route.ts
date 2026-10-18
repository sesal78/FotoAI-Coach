import { defaultV2Deps, defineV2Handler, getPlacePhoto } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/places/:placeId/photo?name&maxPx - a short-lived photo URL (no key). */
export const GET = defineV2Handler(defaultV2Deps, getPlacePhoto);
