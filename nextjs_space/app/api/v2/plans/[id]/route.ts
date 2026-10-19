import { defaultV2Deps, defineV2Handler, getPlan, patchPlan } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/plans/:id - one plan with its steps and the fresh place name. */
export const GET = defineV2Handler(defaultV2Deps, getPlan);

/** PATCH /api/v2/plans/:id - {status}: active, done or archived. */
export const PATCH = defineV2Handler(defaultV2Deps, patchPlan);
