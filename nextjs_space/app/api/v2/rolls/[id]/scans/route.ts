import { defaultV2Deps, defineV2Handler, matchScans } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** POST /api/v2/rolls/:id/scans - {photoIds, overrides?}: pair lab scans to logged frames. */
export const POST = defineV2Handler(defaultV2Deps, matchScans);
