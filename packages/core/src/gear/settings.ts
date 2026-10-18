// Checks camera settings against what the carried body, lens and film can really do, and
// clamps them to the nearest possible values. The shoot-plan generator (2E) runs every
// AI-suggested step through these, so an impossible setting is never shown.

import type { Body, ExposureMode, Lens } from './types.ts';

export interface Settings {
  mode: ExposureMode;
  aperture?: number;
  shutterSeconds?: number;
  iso?: number;
  focalMm?: number;
  whiteBalance?: string;
  filmSimulation?: string;
}

export interface FilmLoad {
  stock: string;
  boxIso: number;
  ratedIso?: number;
}

export interface Loadout {
  body: Body;
  lens: Lens;
  film?: FilmLoad;
}

export type SettingIssue = {
  field: 'mode' | 'aperture' | 'shutterSeconds' | 'iso' | 'focalMm' | 'film' | 'lens' | 'filmSimulation';
  message: string;
};

const MODE_FALLBACK: ExposureMode[] = ['A', 'P', 'M', 'S'];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const fmt = (n: number) => String(Math.round(n * 10) / 10);
const shutterText = (s: number) => (s >= 1 ? `${fmt(s)} s` : `1/${Math.round(1 / s)} s`);

/**
 * Largest aperture (smallest f-number) at a focal length. A variable-aperture zoom gives its
 * wide value only at the wide end: its real steps are not recorded, and a straight line between
 * the ends would suggest apertures the lens cannot reach (the 70-300 is f/5.6 from about 200mm).
 */
export function maxApertureAt(lens: Lens, focalMm: number): number {
  return focalMm <= lens.focalMm.min ? lens.maxAperture.wide : lens.maxAperture.tele;
}

const mountKey = (mount: string) => mount.trim().replace(/\s+/g, ' ').toLowerCase();

function lensFits(body: Body, lens: Lens): boolean {
  if (body.fixedLensId) return lens.id === body.fixedLensId;
  return lens.mount !== null && body.mount !== null && mountKey(lens.mount) === mountKey(body.mount);
}

/** The focal length an aperture is checked at: the long end when none is given (reachable at every length). */
const focalFor = (lens: Lens, s: Settings) => clamp(s.focalMm ?? lens.focalMm.max, lens.focalMm.min, lens.focalMm.max);

/** In A or P mode, or on a body with no M or S mode, the camera picks the shutter speed. */
function cameraPicksShutter(body: Body, mode: ExposureMode): boolean {
  return mode === 'A' || mode === 'P' || !body.modes.some((m) => m === 'M' || m === 'S');
}

/** Fastest timed speed at this aperture (leaf shutters are slower wide open); the tightest limit when unknown. */
function fastestAt(body: Body, aperture: number | undefined): number {
  let fastest = body.shutter.fastestSeconds;
  for (const limit of body.shutter.apertureLimits ?? []) {
    if (aperture === undefined || aperture < limit.belowAperture) fastest = Math.max(fastest, limit.fastestSeconds);
  }
  return fastest;
}

/** Longer than the slowest timed speed is fine on a bulb body, or when the limit is unknown. */
function tooSlow(body: Body, seconds: number): boolean {
  const { slowestSeconds, bulb } = body.shutter;
  return slowestSeconds !== null && seconds > slowestSeconds && bulb !== true;
}

function requiredIso(loadout: Loadout): number | null {
  if (loadout.body.type !== 'film' || !loadout.film) return null;
  return loadout.film.ratedIso ?? loadout.film.boxIso;
}

function issuesFor(loadout: Loadout, s: Settings): SettingIssue[] {
  const { body, lens } = loadout;
  const issues: SettingIssue[] = [];

  if (!lensFits(body, lens)) {
    issues.push({ field: 'lens', message: `${lens.make} ${lens.model} does not fit the ${body.make} ${body.model}` });
  }
  if (!body.modes.includes(s.mode)) {
    issues.push({ field: 'mode', message: `${body.model} offers ${body.modes.join('/')} only` });
  }
  if (s.shutterSeconds !== undefined) {
    const fastest = fastestAt(body, s.aperture);
    if (cameraPicksShutter(body, s.mode)) {
      issues.push({ field: 'shutterSeconds', message: `${body.model} chooses the shutter speed itself` });
    } else if (s.shutterSeconds < fastest || tooSlow(body, s.shutterSeconds)) {
      const slowest = body.shutter.slowestSeconds;
      issues.push({
        field: 'shutterSeconds',
        message: `${body.model} shutter runs ${slowest === null ? 'up' : shutterText(slowest)} to ${shutterText(fastest)} here`,
      });
    }
  }
  if (s.focalMm !== undefined && (s.focalMm < lens.focalMm.min || s.focalMm > lens.focalMm.max)) {
    issues.push({ field: 'focalMm', message: `${lens.model} covers ${lens.focalMm.min}–${lens.focalMm.max}mm` });
  }
  if (s.aperture !== undefined) {
    const widest = maxApertureAt(lens, focalFor(lens, s));
    if (s.aperture < widest || s.aperture > lens.minAperture) {
      issues.push({ field: 'aperture', message: `${lens.model} stops f/${fmt(widest)} to f/${fmt(lens.minAperture)} here` });
    }
  }
  if (body.type === 'film') {
    if (!loadout.film) {
      issues.push({ field: 'film', message: 'Load a film stock first' });
    } else if (s.iso !== undefined && s.iso !== requiredIso(loadout)) {
      issues.push({ field: 'iso', message: `ISO is fixed at ${requiredIso(loadout)} for this roll` });
    }
  } else if (s.iso !== undefined && body.iso && (s.iso < body.iso.min || s.iso > body.iso.max)) {
    issues.push({ field: 'iso', message: `${body.model} ISO runs ${body.iso.min}–${body.iso.max}` });
  }
  if (s.filmSimulation !== undefined && !(body.type === 'digital' && body.make === 'Fujifilm')) {
    issues.push({ field: 'filmSimulation', message: 'Film simulations exist on Fujifilm digital cameras only' });
  }
  return issues;
}

export function validateSettings(
  loadout: Loadout,
  settings: Settings,
): { ok: true; settings: Settings } | { ok: false; issues: SettingIssue[] } {
  const issues = issuesFor(loadout, settings);
  return issues.length === 0 ? { ok: true, settings } : { ok: false, issues };
}

export function clampSettings(loadout: Loadout, settings: Settings): { settings: Settings; changes: SettingIssue[] } {
  const changes = issuesFor(loadout, settings);
  if (changes.length === 0) return { settings, changes };
  const { body, lens } = loadout;
  const s: Settings = { ...settings };

  if (!body.modes.includes(s.mode)) s.mode = MODE_FALLBACK.find((m) => body.modes.includes(m)) ?? body.modes[0]!;
  if (s.focalMm !== undefined) s.focalMm = clamp(s.focalMm, lens.focalMm.min, lens.focalMm.max);
  if (s.aperture !== undefined) {
    s.aperture = clamp(s.aperture, maxApertureAt(lens, focalFor(lens, s)), lens.minAperture);
  }
  if (s.shutterSeconds !== undefined) {
    if (cameraPicksShutter(body, s.mode)) delete s.shutterSeconds;
    else if (s.shutterSeconds < fastestAt(body, s.aperture)) s.shutterSeconds = fastestAt(body, s.aperture);
    else if (tooSlow(body, s.shutterSeconds)) s.shutterSeconds = body.shutter.slowestSeconds!;
  }
  const fixedIso = requiredIso(loadout);
  if (fixedIso !== null && s.iso !== undefined) s.iso = fixedIso;
  else if (body.type === 'digital' && body.iso && s.iso !== undefined) s.iso = clamp(s.iso, body.iso.min, body.iso.max);
  if (s.filmSimulation !== undefined && !(body.type === 'digital' && body.make === 'Fujifilm')) delete s.filmSimulation;

  return { settings: s, changes };
}
