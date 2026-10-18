import { defaultV2Deps, defineV2Handler, getActiveChallenge } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/challenges/active - the caller's newest pending or accepted challenge, or null. */
export const GET = defineV2Handler(defaultV2Deps, getActiveChallenge);
