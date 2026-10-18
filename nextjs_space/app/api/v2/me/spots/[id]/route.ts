import { defaultV2Deps, defineV2Handler, deleteMySpot, updateMySpot } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** PATCH /api/v2/me/spots/:id - change notes, favourite, or (own pins only) the name. */
export const PATCH = defineV2Handler(defaultV2Deps, updateMySpot);

/** DELETE /api/v2/me/spots/:id - remove one of the caller's spots. */
export const DELETE = defineV2Handler(defaultV2Deps, deleteMySpot);
