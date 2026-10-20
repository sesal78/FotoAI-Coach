import { defaultV2Deps, defineV2Handler, generateChallenge, listChallenges } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/challenges?status&limit&cursor - the caller's challenges, newest first. */
export const GET = defineV2Handler(defaultV2Deps, listChallenges);

/** POST /api/v2/challenges { type?, force? } - today's open challenge, or a new one (no location). */
export const POST = defineV2Handler(defaultV2Deps, generateChallenge);
