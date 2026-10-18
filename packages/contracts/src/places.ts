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
