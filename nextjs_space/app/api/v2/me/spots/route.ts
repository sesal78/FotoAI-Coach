import { addMySpot, defaultV2Deps, defineV2Handler, listMySpots } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/me/spots - the caller's saved places and own pins (Google names fetched fresh). */
export const GET = defineV2Handler(defaultV2Deps, listMySpots);

/** POST /api/v2/me/spots - save {placeId} or {pin: {name, lat, lng}}, with optional notes. */
export const POST = defineV2Handler(defaultV2Deps, addMySpot);
