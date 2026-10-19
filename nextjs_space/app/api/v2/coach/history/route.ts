import { clearCoachHistory, defaultV2Deps, defineV2Handler, getCoachHistory } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/coach/history - the caller's last 50 coach messages, oldest first. */
export const GET = defineV2Handler(defaultV2Deps, getCoachHistory);

/** DELETE /api/v2/coach/history - clears the caller's coach messages. */
export const DELETE = defineV2Handler(defaultV2Deps, clearCoachHistory);
