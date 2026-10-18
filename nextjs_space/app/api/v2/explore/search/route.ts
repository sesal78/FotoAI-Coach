import { defaultV2Deps, defineV2Handler, exploreSearch } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/explore/search?q&lat&lng - Google text search, biased to a point when given. */
export const GET = defineV2Handler(defaultV2Deps, exploreSearch);
