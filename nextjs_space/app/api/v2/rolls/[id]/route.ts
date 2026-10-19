import { defaultV2Deps, defineV2Handler, deleteRoll, getRoll, patchRoll } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/rolls/:id - one roll with its frames in order. */
export const GET = defineV2Handler(defaultV2Deps, getRoll);

/** PATCH /api/v2/rolls/:id - {status}, forward only: loaded, finished, developed, scanned. */
export const PATCH = defineV2Handler(defaultV2Deps, patchRoll);

/** DELETE /api/v2/rolls/:id - remove a roll and its frames. */
export const DELETE = defineV2Handler(defaultV2Deps, deleteRoll);
