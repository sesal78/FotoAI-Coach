import { addMyGear, defaultV2Deps, defineV2Handler, listMyGear } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/me/gear - the caller's gear. */
export const GET = defineV2Handler(defaultV2Deps, listMyGear);

/** POST /api/v2/me/gear - add gear: {catalogId} or {custom: body|lens with full capability}. */
export const POST = defineV2Handler(defaultV2Deps, addMyGear);
