import { defaultV2Deps, defineV2Handler, getConditions } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/conditions?lat&lng&date - light times and weather for a point (no Google call). */
export const GET = defineV2Handler(defaultV2Deps, getConditions);
