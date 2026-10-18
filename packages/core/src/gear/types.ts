// Camera and lens capability data. Every catalog value carries the URLs it came from;
// a value that could not be sourced is left out (null), never guessed.

export type BodyType = 'digital' | 'film';
export type ExposureMode = 'P' | 'A' | 'S' | 'M';

export interface Body {
  id: string;
  make: string;
  model: string;
  type: BodyType;
  /** null for a fixed-lens body. */
  mount: string | null;
  modes: ExposureMode[];
  /**
   * Timed shutter range in seconds; `bulb` allows longer exposures (null = not sourced).
   * `apertureLimits`: leaf shutters that cannot reach `fastestSeconds` at wide apertures; at any
   * aperture wider (smaller f-number) than `belowAperture`, the fastest speed is the limit's.
   */
  shutter: {
    slowestSeconds: number | null;
    fastestSeconds: number;
    bulb: boolean | null;
    apertureLimits?: Array<{ belowAperture: number; fastestSeconds: number }>;
  };
  flashSyncSeconds: number | null;
  /** Digital: standard ISO range. Film: the film-speed dial range. null = not sourced. */
  iso: { min: number; max: number } | null;
  /** Short description for the guide (e.g. "centre-weighted"); never used for checks. */
  metering: string | null;
  fixedLensId: string | null;
  sources: string[];
}

export interface Lens {
  id: string;
  make: string;
  model: string;
  /** null for a body's built-in lens. */
  mount: string | null;
  focalMm: { min: number; max: number };
  /** Largest aperture (smallest f-number) at the wide and the tele end. */
  maxAperture: { wide: number; tele: number };
  /** Smallest aperture (largest f-number). */
  minAperture: number;
  sources: string[];
}
