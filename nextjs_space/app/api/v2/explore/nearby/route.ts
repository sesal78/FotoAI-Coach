import { defaultV2Deps, defineV2Handler, exploreNearby } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/explore/nearby?lat&lng&radiusM&type - photo-worthy Google places near a point. */
export const GET = defineV2Handler(defaultV2Deps, exploreNearby);
