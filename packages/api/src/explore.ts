// v2 conditions, explore and place endpoints. Light is computed in code; weather comes from the
// shared weather service; places come fresh from Google and are never stored. The order in
// every handler matters: sign-in, identity keys, query checks, then the rate limit, then the
// outside call, so a bad request costs no Google call and no reservation.

import { PLACE_ID_RE } from '@fotoai/contracts';
import { lightTimes } from '@fotoai/core';
import { createUserClient } from '@fotoai/db';
import { PHOTO_NAME } from '@fotoai/places';
import { z } from 'zod';

import { rejectBrowserIdentity, requirePrincipal } from './auth.ts';
import { ApiError, json, type V2Body, type V2Deps } from './handler.ts';
import { placesConfigured, placesFor } from './places-client.ts';
import { reserveCalls } from './rate-limit.ts';
import { SPOT_COLUMNS, toSpot, type SpotRow } from './spots.ts';

/** A number query parameter: present, not blank, finite, within the range. */
const num = (min: number, max: number) =>
  z.string().trim().min(1).transform(Number).pipe(z.number().finite().min(min).max(max));
const lat = num(-90, 90);
const lng = num(-180, 180);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const ConditionsQuery = z.object({ lat, lng, date: date.optional() });
const NearbyQuery = z.object({
  lat,
  lng,
  radiusM: num(1, 50_000).optional(),
  type: z.string().regex(/^[a-z_]{2,40}$/).optional(),
});
const SearchQuery = z
  .object({ q: z.string().trim().min(1).max(120), lat: lat.optional(), lng: lng.optional(), radiusM: num(1, 50_000).optional() })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), { message: 'lat and lng go together', path: ['lat'] });
const PhotoQuery = z.object({ name: z.string().regex(PHOTO_NAME), maxPx: num(1, 1600).optional() });

function readQuery<T extends z.ZodTypeAny>(request: Request, schema: T): z.infer<T> {
  const params = new URL(request.url).searchParams;
  rejectBrowserIdentity(params);
  const parsed = schema.safeParse(Object.fromEntries(params));
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.map(String).join('.') || 'query'))];
    throw new ApiError('validation', `Invalid query: ${fields.join(', ')}`);
  }
  return parsed.data;
}

function placeIdFrom(params: Record<string, string>): string {
  const id = params.placeId ?? '';
  if (!PLACE_ID_RE.test(id)) throw new ApiError('validation', 'placeId is not a Google place id');
  return id;
}

function requirePlaces(deps: V2Deps): void {
  if (!placesConfigured(deps)) throw new ApiError('config', 'Places is not configured');
}

function light(latValue: number, lngValue: number, day?: string) {
  try {
    return lightTimes(latValue, lngValue, day);
  } catch (err) {
    if (err instanceof RangeError) throw new ApiError('validation', `Invalid query: ${err.message}`);
    throw err;
  }
}

export const getConditions: V2Body = async (request, deps) => {
  await requirePrincipal(request, deps);
  const q = readQuery(request, ConditionsQuery);
  return json({ light: light(q.lat, q.lng, q.date), weather: await deps.weather.get(q.lat, q.lng) });
};

export const exploreNearby: V2Body = async (request, deps) => {
  const principal = await requirePrincipal(request, deps);
  const q = readQuery(request, NearbyQuery);
  requirePlaces(deps);
  await reserveCalls(deps.env, principal, 'places', 1, deps.now());
  const places = await placesFor(deps).nearby(q.lat, q.lng, q.radiusM ?? 2000, q.type ? [q.type] : undefined);
  return json({ places });
};

export const exploreSearch: V2Body = async (request, deps) => {
  const principal = await requirePrincipal(request, deps);
  const q = readQuery(request, SearchQuery);
  requirePlaces(deps);
  await reserveCalls(deps.env, principal, 'places', 1, deps.now());
  const near = q.lat !== undefined && q.lng !== undefined ? { lat: q.lat, lng: q.lng, radiusM: q.radiusM ?? 5000 } : undefined;
  return json({ places: await placesFor(deps).search(q.q, near) });
};

export const getPlace: V2Body = async (request, deps, { params }) => {
  const principal = await requirePrincipal(request, deps);
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const placeId = placeIdFrom(params);
  requirePlaces(deps);
  await reserveCalls(deps.env, principal, 'places', 1, deps.now());
  const place = await placesFor(deps).details(placeId, 'detail');
  if (!place) throw new ApiError('not_found', 'Google has no such place');

  const [weather, saved] = await Promise.all([
    deps.weather.get(place.location.lat, place.location.lng),
    createUserClient(deps.env, principal.accessToken).from('fotoai_places').select(SPOT_COLUMNS).eq('place_id', placeId).maybeSingle(),
  ]);
  if (saved.error) throw new ApiError('upstream', 'Could not load the spot');
  const spot = saved.data ? toSpot(saved.data as unknown as SpotRow, { name: place.name, location: place.location }) : null;
  return json({ place, light: light(place.location.lat, place.location.lng), weather, spot });
};

export const getPlacePhoto: V2Body = async (request, deps, { params }) => {
  const principal = await requirePrincipal(request, deps);
  const placeId = placeIdFrom(params);
  const q = readQuery(request, PhotoQuery);
  if (!q.name.startsWith(`places/${placeId}/photos/`)) throw new ApiError('validation', 'The photo does not belong to this place');
  requirePlaces(deps);
  await reserveCalls(deps.env, principal, 'place_photos', 1, deps.now());
  // Attributions travel with each PhotoRef in the list and detail answers; this call has none.
  return json(await placesFor(deps).photoUri(q.name, q.maxPx ?? 800));
};
