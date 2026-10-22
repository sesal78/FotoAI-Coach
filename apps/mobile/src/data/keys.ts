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
  // About 1 km cells, per day: the light and the weather do not change within one.
  conditions: (at: { lat: number; lng: number }, day: string) => ['conditions', round(at.lat), round(at.lng), day] as const,
};
