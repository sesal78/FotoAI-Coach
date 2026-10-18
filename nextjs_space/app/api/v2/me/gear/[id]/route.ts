import { defaultV2Deps, defineV2Handler, deleteMyGear } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** DELETE /api/v2/me/gear/:id - remove one of the caller's gear rows (404 for anyone else's). */
export const DELETE = defineV2Handler(defaultV2Deps, deleteMyGear);
