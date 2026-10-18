// Place shapes shared by the API, web and mobile (refactor 2D). Names, photos and details come
// fresh from Google Places on every request and are never stored (Google Maps Platform terms).

import { z } from 'zod';

/** Google place types a photographer is likely to want, used when a nearby search names none. */
export const PHOTO_TYPES = [
  'tourist_attraction',
  'park',
  'beach',
  'national_park',
  'hiking_area',
  'observation_deck',
  'garden',
  'historical_landmark',
  'marina',
  'plaza',
  'scenic_spot',
] as const;

const LatLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const PhotoRef = z.object({
  name: z.string(),
  attributions: z.array(z.object({ displayName: z.string(), uri: z.string().nullable() })),
});

export type PhotoRef = z.infer<typeof PhotoRef>;

export const PlaceSummary = z.object({
  placeId: z.string(),
  name: z.string(),
  location: LatLng,
  primaryType: z.string().nullable(),
  types: z.array(z.string()),
  distanceM: z.number().nullable(),
  photo: PhotoRef.nullable(),
});

export type PlaceSummary = z.infer<typeof PlaceSummary>;

export const PlaceDetail = PlaceSummary.extend({
  formattedAddress: z.string().nullable(),
  googleMapsUri: z.string().nullable(),
  photos: z.array(PhotoRef).max(5),
});

export type PlaceDetail = z.infer<typeof PlaceDetail>;

/** A Google place id as the Places API returns it. */
export const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,300}$/;

const notes = z.string().trim().max(2000);

const GoogleSpotInput = z.object({ placeId: z.string().regex(PLACE_ID_RE), notes: notes.optional() }).strict();
const PinSpotInput = z
  .object({
    pin: z.object({ name: z.string().trim().min(1).max(80), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).strict(),
    notes: notes.optional(),
  })
  .strict();

export const SpotInput = z.union([GoogleSpotInput, PinSpotInput]);
export type SpotInput = z.infer<typeof SpotInput>;

/** Picks the exact schema by the body's shape, so errors name the real field (a union would not). */
export function parseSpotInput(body: unknown) {
  const isPin = typeof body === 'object' && body !== null && 'pin' in body && !('placeId' in body);
  return (isPin ? PinSpotInput : GoogleSpotInput).safeParse(body) as z.SafeParseReturnType<unknown, SpotInput>;
}

export const SpotPatch = z
  .object({ notes: notes.nullable().optional(), favourite: z.boolean().optional(), name: z.string().trim().min(1).max(80).optional() })
  .strict()
  .refine((p) => Object.keys(p).length > 0, 'Nothing to change');
export type SpotPatch = z.infer<typeof SpotPatch>;

export const SpotDto = z.object({
  id: z.string().uuid(),
  source: z.enum(['google', 'user']),
  placeId: z.string().nullable(),
  name: z.string().nullable(),
  location: LatLng.nullable(),
  notes: z.string().nullable(),
  favourite: z.boolean(),
  createdAt: z.string(),
  unavailable: z.boolean(),
});
export type SpotDto = z.infer<typeof SpotDto>;

export const PlaceExplanationDto = z.object({
  bestLight: z.string().max(300),
  angles: z.array(z.string().max(200)).max(3),
  caution: z.string().max(200).nullable(),
  prompt: z.object({ id: z.string(), version: z.number().int() }),
});
export type PlaceExplanationDto = z.infer<typeof PlaceExplanationDto>;
