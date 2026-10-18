// Film exposure helpers: the sunny 16 rule, frame counting and push/pull. Daylight only:
// blue hour light changes too fast for a fixed rule, so it returns null (the guide then
// says to meter and bracket instead of guessing).

export type Scene =
  | 'snow_sand'
  | 'full_sun'
  | 'slight_overcast'
  | 'overcast'
  | 'heavy_overcast'
  | 'open_shade'
  | 'golden_hour'
  | 'blue_hour';

/** Whole-stop shutter speeds in seconds, slowest first (8 s to 1/4000 s). */
export const STANDARD_SHUTTER_SECONDS: readonly number[] = [
  8, 4, 2, 1, 1 / 2, 1 / 4, 1 / 8, 1 / 15, 1 / 30, 1 / 60, 1 / 125, 1 / 250, 1 / 500, 1 / 1000, 1 / 2000, 1 / 4000,
];

const SCENE_APERTURE: Record<Exclude<Scene, 'blue_hour'>, number> = {
  snow_sand: 22,
  full_sun: 16,
  slight_overcast: 11,
  overcast: 8,
  heavy_overcast: 5.6,
  open_shade: 5.6,
  golden_hour: 5.6, // 3 stops more light than full sun
};

/** The standard speed nearest to `seconds`, measured in stops. */
export function nearestShutter(seconds: number): number {
  const target = Math.log2(seconds);
  let best = STANDARD_SHUTTER_SECONDS[0]!;
  for (const speed of STANDARD_SHUTTER_SECONDS) {
    if (Math.abs(Math.log2(speed) - target) < Math.abs(Math.log2(best) - target)) best = speed;
  }
  return best;
}

export function sunny16(scene: Scene, iso: number): { aperture: number; shutterSeconds: number } | null {
  if (scene === 'blue_hour') return null;
  return { aperture: SCENE_APERTURE[scene], shutterSeconds: nearestShutter(1 / iso) };
}

export function framesLeft(roll: { exposures: number; framesLogged: number }): number {
  return Math.max(0, roll.exposures - roll.framesLogged);
}

/** Stops of push (+) or pull (−) when a film is rated away from its box speed, to the nearest third. */
export function pushPullStops(boxIso: number, ratedIso: number): number {
  return Math.round(Math.log2(ratedIso / boxIso) * 3) / 3;
}
