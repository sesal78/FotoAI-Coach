import { defaultV2Deps, defineV2Handler, getGearCatalog } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/gear/catalog - camera bodies and lenses with sourced capability data. */
export const GET = defineV2Handler(defaultV2Deps, getGearCatalog);
