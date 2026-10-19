import { defaultV2Deps, defineV2Handler, getPhotoUrl } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/photos/:id/url - a signed read link that lasts 5 minutes. */
export const GET = defineV2Handler(defaultV2Deps, getPhotoUrl);
