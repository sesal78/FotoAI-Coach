import { defaultV2Deps, defineV2Handler, getLoadout, putLoadout } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/me/loadout - what the caller carries today, resolved with capabilities, or null. */
export const GET = defineV2Handler(defaultV2Deps, getLoadout);

/** PUT /api/v2/me/loadout - {bodyGearId, lensGearId?, film?}; the lens must fit the body. */
export const PUT = defineV2Handler(defaultV2Deps, putLoadout);
