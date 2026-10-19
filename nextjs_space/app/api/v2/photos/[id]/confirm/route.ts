import { confirmPhoto, defaultV2Deps, defineV2Handler } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** POST /api/v2/photos/:id/confirm - check the upload, match a plan step by time, mark ready. */
export const POST = defineV2Handler(defaultV2Deps, confirmPhoto);
