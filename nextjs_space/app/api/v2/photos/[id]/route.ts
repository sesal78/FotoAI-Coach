import { defaultV2Deps, defineV2Handler, getPhoto } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/photos/:id - one of my photos, pending or ready. */
export const GET = defineV2Handler(defaultV2Deps, getPhoto);
