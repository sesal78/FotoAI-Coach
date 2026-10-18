import { defaultV2Deps, defineV2Handler, getPreferences, patchPreferences } from '@fotoai/api';

export const dynamic = 'force-dynamic';

/** GET /api/v2/me/preferences - theme, units and home area (defaults when none are saved). */
export const GET = defineV2Handler(defaultV2Deps, getPreferences);

/** PATCH /api/v2/me/preferences - change any of theme, units, home ({lat, lng, label?} or null). */
export const PATCH = defineV2Handler(defaultV2Deps, patchPreferences);
