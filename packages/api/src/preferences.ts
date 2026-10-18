// v2 preferences: theme, units and home area. The home label is the existing home_location
// column (the live app's challenge generator also reads it). Rows go through the user's own
// token, so RLS limits reads and writes to the owner.

import { PreferencesPatch, type Preferences } from '@fotoai/contracts';
import { createUserClient } from '@fotoai/db';

import { rejectBrowserIdentity, requirePrincipal } from './auth.ts';
import { ApiError, json, type V2Body } from './handler.ts';

const TABLE = 'fotoai_user_preferences';
const COLUMNS = 'theme, units, home_lat, home_lng, home_location';
const MAX_BODY = 4096;

const DEFAULTS: Preferences = { theme: 'golden', units: 'metric', home: null };

type PreferenceRow = {
  theme: string;
  units: string;
  home_lat: number | null;
  home_lng: number | null;
  home_location: string | null;
};

function toPreferences(row: PreferenceRow | null): Preferences {
  if (!row) return DEFAULTS;
  return {
    theme: row.theme as Preferences['theme'],
    units: row.units as Preferences['units'],
    home: row.home_lat !== null && row.home_lng !== null ? { lat: row.home_lat, lng: row.home_lng, label: row.home_location } : null,
  };
}

async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new ApiError('validation', 'Request body is too large');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError('validation', 'Request body must be JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError('validation', 'Request body must be a JSON object');
  return body as Record<string, unknown>;
}

const saveFailed = () => new ApiError('upstream', 'Could not save preferences');

export const getPreferences: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(TABLE)
    .select(COLUMNS)
    .eq('user_id', principal.userId)
    .maybeSingle();
  if (error) throw new ApiError('upstream', 'Could not load preferences');
  return json(toPreferences(data as PreferenceRow | null));
};

export const patchPreferences: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const parsed = PreferencesPatch.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.') || 'body'))];
    throw new ApiError('validation', `Invalid preferences: ${fields.join(', ')}`);
  }
  const patch = parsed.data;

  const row: Record<string, unknown> = { user_id: principal.userId };
  if (patch.theme) row.theme = patch.theme;
  if (patch.units) row.units = patch.units;
  if (patch.home === null) {
    row.home_lat = null;
    row.home_lng = null;
  } else if (patch.home) {
    row.home_lat = patch.home.lat;
    row.home_lng = patch.home.lng;
    if (patch.home.label !== undefined) row.home_location = patch.home.label || null;
  }

  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(TABLE)
    .upsert(row as never, { onConflict: 'user_id' })
    .select(COLUMNS)
    .single();
  if (error || !data) throw saveFailed();
  return json(toPreferences(data as unknown as PreferenceRow));
};
