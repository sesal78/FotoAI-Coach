import { defaultV2Deps, defineV2Handler, patchPlanStep } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** PATCH /api/v2/plans/:id/steps/:stepId - {status, updatedAt}; last write wins, older writes are not applied. */
export const PATCH = defineV2Handler(defaultV2Deps, patchPlanStep);
