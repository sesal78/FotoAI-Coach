import { createRoll, defaultV2Deps, defineV2Handler, listRolls } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/rolls - the caller's rolls, newest first, with frames logged and left. */
export const GET = defineV2Handler(defaultV2Deps, listRolls);

/** POST /api/v2/rolls - load a roll (client id; a replay returns the stored roll). */
export const POST = defineV2Handler(defaultV2Deps, createRoll);
