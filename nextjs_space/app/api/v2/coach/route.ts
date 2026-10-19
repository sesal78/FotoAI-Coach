import { coachReply, defaultV2Deps, defineV2Handler } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** POST /api/v2/coach { message, context } - one coach reply with at most one checked proposal. */
export const POST = defineV2Handler(defaultV2Deps, coachReply);
