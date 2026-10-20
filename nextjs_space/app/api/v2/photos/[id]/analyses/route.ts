import { defaultV2Deps, defineV2Handler, listPhotoAnalyses } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/photos/:id/analyses - the photo's analyses, newest first. */
export const GET = defineV2Handler(defaultV2Deps, listPhotoAnalyses);
