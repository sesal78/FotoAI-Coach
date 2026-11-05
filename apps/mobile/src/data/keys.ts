// Every query key in one place, so a write knows exactly which reads it changes.

const round = (n: number) => Math.round(n * 100) / 100;

export const keys = {
  me: ['me'] as const,
  progress: ['me', 'progress'] as const,
  preferences: ['me', 'preferences'] as const,
  myGear: ['me', 'gear'] as const,
  loadout: ['me', 'loadout'] as const,
  spots: ['me', 'spots'] as const,
  catalog: ['gear', 'catalog'] as const,
  activeChallenge: ['challenges', 'active'] as const,
  challenge: (id: string) => ['challenges', id] as const,
  nearby: (at: { lat: number; lng: number }, type: string | null) => ['explore', 'nearby', round(at.lat), round(at.lng), type ?? 'any'] as const,
  search: (q: string, at: { lat: number; lng: number } | null) => ['explore', 'search', q, at ? round(at.lat) : null, at ? round(at.lng) : null] as const,
  place: (placeId: string) => ['explore', 'place', placeId] as const,
  placePhoto: (placeId: string, name: string) => ['explore', 'photo', placeId, name] as const,
  // Under their own prefix: invalidating spots or places must never re-run a paid AI explain.
  explainPlace: (placeId: string) => ['explain', 'place', placeId] as const,
  explainSpot: (spotId: string) => ['explain', 'spot', spotId] as const,
  // Shoot (3E): plans and film rolls, kept on the phone; field changes wait in the outbox.
  plans: ['shoot', 'plans'] as const,
  plan: (id: string) => ['shoot', 'plan', id] as const,
  rolls: ['shoot', 'rolls'] as const,
  roll: (id: string) => ['shoot', 'roll', id] as const,
  // Photos (3F): the library (pages, newest first) and one photo.
  photos: ['photos', 'list'] as const,
  photo: (id: string) => ['photos', 'one', id] as const,
  // The photo's signed read link: kept in memory only (meta.save: false), never on the phone.
  photoUrl: (id: string) => ['photos', 'url', id] as const,
  // A film roll's scans (GET /photos?rollId=), with the frame each one is paired with.
  rollScans: (rollId: string) => ['photos', 'roll', rollId] as const,
  // A photo's saved AI results (critique, editing tips, recreate), newest first.
  analyses: (photoId: string) => ['photos', 'analyses', photoId] as const,
  // The coach chat: kept in memory only (meta.save: false), never on the phone.
  coachHistory: ['coach', 'history'] as const,
  // About 1 km cells, per day: the light and the weather do not change within one.
  conditions: (at: { lat: number; lng: number }, day: string) => ['conditions', round(at.lat), round(at.lng), day] as const,
};
