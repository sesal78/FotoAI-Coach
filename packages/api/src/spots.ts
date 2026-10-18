// v2 my spots: saved Google places and the user's own pins (fotoai_places, owner RLS). A Google
// row stores only its place_id (Google Maps Platform terms), so its name and coordinates are
// fetched fresh from Place Details whenever a spot is returned. A lookup that fails marks that
// one spot `unavailable` instead of failing the list, so the UI can say so.

import { parseSpotInput, SpotPatch, type SpotDto } from '@fotoai/contracts';
import { createUserClient } from '@fotoai/db';

import { rejectBrowserIdentity, requirePrincipal, type Principal } from './auth.ts';
import { ApiError, json, type V2Body, type V2Deps } from './handler.ts';
import { readJsonObject } from './http.ts';
import { placesConfigured, placesFor, requirePlaces } from './places-client.ts';
import { reserveCalls } from './rate-limit.ts';

const T_PLACES = 'fotoai_places';
export const SPOT_COLUMNS = 'id, source, place_id, name, lat, lng, notes, favourite, created_at';
const LIST_MAX = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SpotRow = {
  id: string;
  source: 'google' | 'user';
  place_id: string | null;
  name: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  favourite: boolean;
  created_at: string;
};

export type Fresh = { name: string; location: { lat: number; lng: number } } | null;

const upstream = (what: string) => new ApiError('upstream', `Could not ${what}`);

function validationFrom(issues: Array<{ path: PropertyKey[] }>): ApiError {
  const fields = [...new Set(issues.map((issue) => issue.path.map(String).join('.') || 'body'))];
  return new ApiError('validation', `Invalid spot: ${fields.join(', ')}`);
}

export function toSpot(row: SpotRow, fresh?: Fresh): SpotDto {
  const google = row.source === 'google';
  return {
    id: row.id,
    source: row.source,
    placeId: row.place_id,
    name: google ? (fresh?.name ?? null) : row.name,
    location: google ? (fresh?.location ?? null) : row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null,
    notes: row.notes,
    favourite: row.favourite,
    createdAt: row.created_at,
    unavailable: google && !fresh,
  };
}

/**
 * Fresh name and coordinates for the Google rows, one reserved `places` call each. Without a
 * Google key, or with the hourly limit used up, nothing is called and those spots come back
 * unavailable: the user's own list and edits are never withheld by the Google limit.
 */
export async function resolveGoogle(deps: V2Deps, principal: Principal, rows: SpotRow[]): Promise<Map<string, Fresh>> {
  const ids = [...new Set(rows.filter((r) => r.source === 'google' && r.place_id).map((r) => r.place_id!))];
  const out = new Map<string, Fresh>();
  if (ids.length === 0 || !placesConfigured(deps)) return out;
  try {
    await reserveCalls(deps.env, principal, 'places', ids.length, deps.now());
  } catch (err) {
    if (err instanceof ApiError && err.code === 'rate_limited') return out;
    throw err;
  }
  const places = placesFor(deps);
  await Promise.all(
    ids.map(async (id) => {
      try {
        const place = await places.details(id, 'summary');
        out.set(id, place ? { name: place.name, location: place.location } : null);
      } catch {
        out.set(id, null);
      }
    }),
  );
  return out;
}

async function spotsWithFresh(deps: V2Deps, principal: Principal, rows: SpotRow[]): Promise<SpotDto[]> {
  const fresh = await resolveGoogle(deps, principal, rows);
  return rows.map((row) => toSpot(row, row.place_id ? (fresh.get(row.place_id) ?? null) : undefined));
}

export const listMySpots: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from(T_PLACES)
    .select(SPOT_COLUMNS)
    .eq('user_id', principal.userId)
    .order('created_at', { ascending: false })
    .limit(LIST_MAX);
  if (error) throw upstream('load spots');
  return json({ spots: await spotsWithFresh(deps, principal, data as unknown as SpotRow[]) });
};

export const addMySpot: V2Body = async (request, deps) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const parsed = parseSpotInput(body);
  if (!parsed.success) throw validationFrom(parsed.error.issues);
  const input = parsed.data;
  const db = createUserClient(deps.env, principal.accessToken);

  if ('pin' in input) {
    const { data, error } = await db
      .from(T_PLACES)
      .insert({ user_id: principal.userId, source: 'user', name: input.pin.name, lat: input.pin.lat, lng: input.pin.lng, notes: input.notes ?? null } as never)
      .select(SPOT_COLUMNS)
      .single();
    if (error || !data) throw upstream('save the spot');
    return json({ spot: toSpot(data as unknown as SpotRow) }, { status: 201 });
  }

  // Google: the place must exist there; its name is shown fresh and never stored.
  requirePlaces(deps);
  await reserveCalls(deps.env, principal, 'places', 1, deps.now());
  const place = await placesFor(deps).details(input.placeId, 'summary');
  if (!place) throw new ApiError('not_found', 'Google has no such place');
  const fresh: Fresh = { name: place.name, location: place.location };

  const existing = async () => {
    const { data, error } = await db.from(T_PLACES).select(SPOT_COLUMNS).eq('user_id', principal.userId).eq('place_id', input.placeId).maybeSingle();
    if (error) throw upstream('load the spot');
    return data as unknown as SpotRow | null;
  };
  const before = await existing();
  if (before) {
    // Saved already: keep the row; new notes, when given, replace the old ones.
    if (input.notes === undefined || input.notes === before.notes) return json({ spot: toSpot(before, fresh) });
    const { data, error } = await db
      .from(T_PLACES)
      .update({ notes: input.notes, updated_at: deps.now().toISOString() } as never)
      .eq('id', before.id)
      .select(SPOT_COLUMNS)
      .single();
    if (error || !data) throw upstream('save the spot');
    return json({ spot: toSpot(data as unknown as SpotRow, fresh) });
  }

  const { data, error } = await db
    .from(T_PLACES)
    .insert({ user_id: principal.userId, source: 'google', place_id: input.placeId, notes: input.notes ?? null } as never)
    .select(SPOT_COLUMNS)
    .single();
  if (error?.code === '23505') {
    const raced = await existing(); // a parallel save won: return its row
    if (raced) return json({ spot: toSpot(raced, fresh) });
  }
  if (error || !data) throw upstream('save the spot');
  return json({ spot: toSpot(data as unknown as SpotRow, fresh) }, { status: 201 });
};

export const updateMySpot: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const id = params.id ?? '';
  if (!UUID.test(id)) throw new ApiError('validation', 'Spot id must be a UUID');
  const body = await readJsonObject(request);
  rejectBrowserIdentity(body);
  const parsed = SpotPatch.safeParse(body);
  if (!parsed.success) throw validationFrom(parsed.error.issues);
  const db = createUserClient(deps.env, principal.accessToken);

  const { data: current, error: readError } = await db.from(T_PLACES).select(SPOT_COLUMNS).eq('id', id).maybeSingle();
  if (readError) throw upstream('load the spot');
  if (!current) throw new ApiError('not_found', 'Spot not found');
  if (parsed.data.name !== undefined && (current as unknown as SpotRow).source === 'google') {
    throw new ApiError('validation', 'A Google place keeps its own name; add notes instead');
  }

  const { data, error } = await db
    .from(T_PLACES)
    .update({ ...parsed.data, updated_at: deps.now().toISOString() } as never)
    .eq('id', id)
    .select(SPOT_COLUMNS)
    .maybeSingle();
  if (error) throw upstream('save the spot');
  if (!data) throw new ApiError('not_found', 'Spot not found');
  const [spot] = await spotsWithFresh(deps, principal, [data as unknown as SpotRow]);
  return json({ spot });
};

export const deleteMySpot: V2Body = async (request, deps, { params }) => {
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const principal = await requirePrincipal(request, deps);
  const id = params.id ?? '';
  if (!UUID.test(id)) throw new ApiError('validation', 'Spot id must be a UUID');
  const { data, error } = await createUserClient(deps.env, principal.accessToken).from(T_PLACES).delete().eq('id', id).select('id');
  if (error) throw upstream('delete the spot');
  if (!data || data.length === 0) throw new ApiError('not_found', 'Spot not found');
  return json({ success: true });
};
