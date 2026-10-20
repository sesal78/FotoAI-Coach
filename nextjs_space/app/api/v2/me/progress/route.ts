import { defaultV2Deps, defineV2Handler, getProgress } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/me/progress - the caller's XP, level, streak and skill tree. */
export const GET = defineV2Handler(defaultV2Deps, getProgress);
