// v2 place explanation: best light and angles for a Google place or one of the user's spots,
// from the facts given only. The answer is returned and never stored.

import { explainPlace, type PlanPlace } from '@fotoai/ai';
import { PLACE_ID_RE } from '@fotoai/contracts';
import { lightTimes } from '@fotoai/core';
import { createUserClient } from '@fotoai/db';

import { rejectBrowserIdentity, requirePrincipal, type Principal } from './auth.ts';
import { ApiError, json, type V2Body, type V2Deps } from './handler.ts';
import { placesFor, requirePlaces } from './places-client.ts';
import { fromAi, requireAi } from './plans.ts';
import { reserveCalls } from './rate-limit.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function answer(deps: V2Deps, principal: Principal, place: PlanPlace): Promise<Response> {
  const { lat, lng } = place.location;
  const weather = await deps.weather.get(lat, lng);
  try {
    const explanation = await explainPlace(deps.ai, { place, light: lightTimes(lat, lng), weather });
    return json({ explanation });
  } catch (err) {
    throw fromAi(err);
  }
}

export const explainGooglePlace: V2Body = async (request, deps, { params }) => {
  const principal = await requirePrincipal(request, deps);
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const placeId = params.placeId ?? '';
  if (!PLACE_ID_RE.test(placeId)) throw new ApiError('validation', 'placeId is not a Google place id');
  requireAi(deps);
  requirePlaces(deps);
  await reserveCalls(deps.env, principal, 'place_explain', 1, deps.now());
  await reserveCalls(deps.env, principal, 'places', 1, deps.now());
  const details = await placesFor(deps).details(placeId, 'summary');
  if (!details) throw new ApiError('not_found', 'Google has no such place');
  return answer(deps, principal, { kind: 'google', placeId, name: details.name, types: details.types, location: details.location });
};

export const explainSpot: V2Body = async (request, deps, { params }) => {
  const principal = await requirePrincipal(request, deps);
  rejectBrowserIdentity(new URL(request.url).searchParams);
  const id = params.id ?? '';
  if (!UUID.test(id)) throw new ApiError('validation', 'Spot id must be a UUID');
  requireAi(deps);
  const { data, error } = await createUserClient(deps.env, principal.accessToken)
    .from('fotoai_places')
    .select('source, place_id, name, lat, lng, notes')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new ApiError('upstream', 'Could not load the spot');
  const spot = data as { source: string; place_id: string | null; name: string | null; lat: number | null; lng: number | null; notes: string | null } | null;
  if (!spot) throw new ApiError('not_found', 'Spot not found');
  if (spot.source === 'google') {
    requirePlaces(deps);
    await reserveCalls(deps.env, principal, 'place_explain', 1, deps.now());
    await reserveCalls(deps.env, principal, 'places', 1, deps.now());
    const details = await placesFor(deps).details(spot.place_id!, 'summary');
    if (!details) throw new ApiError('not_found', 'Google has no such place');
    return answer(deps, principal, { kind: 'google', placeId: details.placeId, name: details.name, types: details.types, location: details.location });
  }
  await reserveCalls(deps.env, principal, 'place_explain', 1, deps.now());
  return answer(deps, principal, { kind: 'pin', name: spot.name!, notes: spot.notes, location: { lat: spot.lat!, lng: spot.lng! } });
};
