// Straight-line ("as the crow flies") distance between two points, for lists and the place screen.

import type { LatLng } from './where';

const EARTH_M = 6_371_008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Haversine distance in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

/** "340 m" up to 1 km, then "1.2 km", and whole km from 10 km. */
export function distanceText(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}
