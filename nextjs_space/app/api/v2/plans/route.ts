import { defaultV2Deps, defineV2Handler, generatePlan, listPlans } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/plans - the caller's newest 20 plans, without steps. */
export const GET = defineV2Handler(defaultV2Deps, listPlans);

/** POST /api/v2/plans - generate a gear-checked plan: {placeId} or {spotId}, optional date. */
export const POST = defineV2Handler(defaultV2Deps, generatePlan);
