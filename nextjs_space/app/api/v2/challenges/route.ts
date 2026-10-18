import { defaultV2Deps, defineV2Handler, listChallenges } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/challenges?status&limit&cursor - the caller's challenges, newest first. */
export const GET = defineV2Handler(defaultV2Deps, listChallenges);
