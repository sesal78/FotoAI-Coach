// Google Places API (New) client: nearby search, text search, place details and photo URLs.
// Field masks are fixed constants with Pro fields only, so no request drifts into the dearer
// Enterprise tier. The key travels only in the X-Goog-Api-Key header. Nothing here is stored:
// the terms allow keeping only the place_id, so callers fetch names and photos fresh.

import { PHOTO_TYPES, PLACE_ID_RE, type PhotoRef, type PlaceDetail, type PlaceSummary } from '@fotoai/contracts';

import type { FetchLike } from './weather.ts';

export type PlacesErrorCode = 'config' | 'validation' | 'upstream';

/** Thrown by the client; the API maps `code` to its own error envelope. */
export class PlacesError extends Error {
  readonly code: PlacesErrorCode;

  constructor(code: PlacesErrorCode, message: string) {
    super(message);
    this.name = 'PlacesError';
    this.code = code;
  }
}

/** Every field this client may ask for (all in the Pro tier or below). */
export const PRO_FIELDS = ['id', 'displayName', 'location', 'types', 'primaryType', 'photos', 'formattedAddress', 'googleMapsUri'] as const;

const SUMMARY_FIELDS = ['id', 'displayName', 'location', 'types', 'primaryType', 'photos'];
const DETAIL_FIELDS = [...SUMMARY_FIELDS, 'formattedAddress', 'googleMapsUri'];
const listMask = SUMMARY_FIELDS.map((f) => `places.${f}`).join(',');

const BASE = 'https://places.googleapis.com/v1';
const TIMEOUT_MS = 10_000;
export const PLACE_ID = PLACE_ID_RE;
export const PHOTO_NAME = /^places\/[A-Za-z0-9_-]{10,300}\/photos\/[A-Za-z0-9_-]{10,1000}$/;

type Sku = 'nearby_pro' | 'search_pro' | 'details_pro' | 'photo_enterprise';
type Log = { info(message: string): void; warn(message: string): void };

type GooglePhoto = { name?: string; authorAttributions?: Array<{ displayName?: string; uri?: string }> };
type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryType?: string;
  photos?: GooglePhoto[];
  formattedAddress?: string;
  googleMapsUri?: string;
};

export interface PlacesClient {
  nearby(lat: number, lng: number, radiusM: number, types?: readonly string[]): Promise<PlaceSummary[]>;
  search(text: string, near?: { lat: number; lng: number; radiusM: number }): Promise<PlaceSummary[]>;
  details(placeId: string, fields?: 'summary' | 'detail'): Promise<PlaceDetail | null>;
  photoUri(photoName: string, maxPx: number): Promise<{ photoUri: string }>;
}

const invalid = (message: string) => new PlacesError('validation', message);

function checkPoint(lat: number, lng: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw invalid('Coordinates are out of range');
  }
}

function checkRadius(radiusM: number): void {
  if (!Number.isFinite(radiusM) || radiusM < 1 || radiusM > 50_000) throw invalid('radiusM must be within 1..50000');
}

/** Great-circle distance in metres, rounded. */
function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

function photoRef(photo: GooglePhoto): PhotoRef | null {
  if (!photo.name) return null;
  return {
    name: photo.name,
    attributions: (photo.authorAttributions ?? []).map((a) => ({ displayName: a.displayName ?? '', uri: a.uri ?? null })),
  };
}

function toSummary(place: GooglePlace, from?: { lat: number; lng: number }): PlaceSummary {
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  if (!place.id || typeof lat !== 'number' || typeof lng !== 'number') throw new PlacesError('upstream', 'Places returned an incomplete place');
  const photos = (place.photos ?? []).map(photoRef).filter((p): p is PhotoRef => p !== null);
  return {
    placeId: place.id,
    name: place.displayName?.text ?? '',
    location: { lat, lng },
    primaryType: place.primaryType ?? null,
    types: place.types ?? [],
    distanceM: from ? distanceM(from, { lat, lng }) : null,
    photo: photos[0] ?? null,
  };
}

function toDetail(place: GooglePlace): PlaceDetail {
  const photos = (place.photos ?? []).map(photoRef).filter((p): p is PhotoRef => p !== null);
  return { ...toSummary(place), formattedAddress: place.formattedAddress ?? null, googleMapsUri: place.googleMapsUri ?? null, photos: photos.slice(0, 5) };
}

export function createPlacesClient(opts: { key: string | undefined; fetch: FetchLike; log?: Log }): PlacesClient {
  const log: Log = opts.log ?? { info: (m) => console.info(m), warn: (m) => console.warn(m) };

  const requireKey = (): string => {
    if (!opts.key) throw new PlacesError('config', 'Places is not configured');
    return opts.key;
  };

  /** One call; null only for a 404 when `allow404` is set. Google's own text never leaves here. */
  async function call<T>(sku: Sku, url: string, init: { method: 'GET' | 'POST'; mask?: string; body?: unknown }, allow404 = false): Promise<T | null> {
    const key = requireKey();
    const headers: Record<string, string> = { 'X-Goog-Api-Key': key };
    if (init.mask) headers['X-Goog-FieldMask'] = init.mask;
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    let response: Response;
    try {
      response = await opts.fetch(url, {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      log.info(`places call sku=${sku} status=error`);
      throw new PlacesError('upstream', 'Places could not be reached');
    }
    log.info(`places call sku=${sku} status=${response.status}`);
    if (allow404 && response.status === 404) return null;
    if (!response.ok) throw new PlacesError('upstream', 'Places request failed');
    try {
      return (await response.json()) as T;
    } catch {
      throw new PlacesError('upstream', 'Places returned a bad body');
    }
  }

  /** List results; an entry without an id or location is skipped (and counted in the log), not fatal. */
  const summaries = (places: GooglePlace[] | undefined, from?: { lat: number; lng: number }): PlaceSummary[] => {
    const out: PlaceSummary[] = [];
    let skipped = 0;
    for (const place of places ?? []) {
      try {
        out.push(toSummary(place, from));
      } catch {
        skipped++;
      }
    }
    if (skipped > 0) log.warn(`places skipped ${skipped} incomplete result(s)`);
    return out;
  };

  return {
    async nearby(lat, lng, radiusM, types = PHOTO_TYPES) {
      requireKey();
      checkPoint(lat, lng);
      checkRadius(radiusM);
      const body = {
        includedTypes: [...types],
        maxResultCount: 20,
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusM } },
      };
      const data = await call<{ places?: GooglePlace[] }>('nearby_pro', `${BASE}/places:searchNearby`, { method: 'POST', mask: listMask, body });
      return summaries(data?.places, { lat, lng });
    },

    async search(text, near) {
      requireKey();
      const query = text.trim();
      if (query.length < 1 || query.length > 120) throw invalid('Search text must be 1..120 characters');
      if (near) {
        checkPoint(near.lat, near.lng);
        checkRadius(near.radiusM);
      }
      const body = {
        textQuery: query,
        pageSize: 20,
        ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: near.radiusM } } } : {}),
      };
      const data = await call<{ places?: GooglePlace[] }>('search_pro', `${BASE}/places:searchText`, { method: 'POST', mask: listMask, body });
      return summaries(data?.places, near);
    },

    async details(placeId, fields = 'detail') {
      requireKey();
      if (!PLACE_ID.test(placeId)) throw invalid('placeId is not a Google place id');
      const mask = (fields === 'summary' ? SUMMARY_FIELDS : DETAIL_FIELDS).join(',');
      const data = await call<GooglePlace>('details_pro', `${BASE}/places/${placeId}`, { method: 'GET', mask }, true);
      return data ? toDetail(data) : null;
    },

    async photoUri(photoName, maxPx) {
      const key = requireKey();
      if (!PHOTO_NAME.test(photoName)) throw invalid('Not a Google photo name');
      if (!Number.isInteger(maxPx) || maxPx < 1 || maxPx > 1600) throw invalid('maxPx must be within 1..1600');
      const data = await call<{ photoUri?: string }>('photo_enterprise', `${BASE}/${photoName}/media?maxWidthPx=${maxPx}&skipHttpRedirect=true`, {
        method: 'GET',
      });
      const uri = data?.photoUri;
      if (typeof uri !== 'string' || !uri.startsWith('https://')) throw new PlacesError('upstream', 'Places returned no photo');
      if (uri.includes(key)) {
        log.warn('places photoUri carried the key; refused');
        throw new PlacesError('upstream', 'Places returned an unsafe photo URL');
      }
      return { photoUri: uri };
    },
  };
}
