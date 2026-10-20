import { analysePhoto, defaultV2Deps, defineV2Handler } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** POST /api/v2/photos/:id/analyse { mode } - a critique, editing tips or how to recreate a checked photo. */
export const POST = defineV2Handler(defaultV2Deps, analysePhoto);
