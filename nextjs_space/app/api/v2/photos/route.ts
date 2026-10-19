import { createPhoto, defaultV2Deps, defineV2Handler, listPhotos } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/photos - the caller's ready photos, newest first, 50 per page (cursor). */
export const GET = defineV2Handler(defaultV2Deps, listPhotos);

/** POST /api/v2/photos - create a photo (client id) and get a one-time upload link. */
export const POST = defineV2Handler(defaultV2Deps, createPhoto);
