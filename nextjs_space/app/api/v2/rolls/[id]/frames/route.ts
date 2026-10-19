import { addFrame, defaultV2Deps, defineV2Handler } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** POST /api/v2/rolls/:id/frames - log a frame (client id; a replay returns the stored frame). */
export const POST = defineV2Handler(defaultV2Deps, addFrame);
