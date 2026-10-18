import { defaultV2Deps, defineV2Handler, getChallenge } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/challenges/:id - one of the caller's challenges (404 for anyone else's). */
export const GET = defineV2Handler(defaultV2Deps, getChallenge);
