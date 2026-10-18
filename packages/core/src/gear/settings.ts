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

/** Largest aperture (smallest f-number) at a focal length; linear between the zoom ends. */
export function maxApertureAt(lens: Lens, focalMm: number): number {
  const { min, max } = lens.focalMm;
  if (max === min || focalMm <= min) return lens.maxAperture.wide;
  if (focalMm >= max) return lens.maxAperture.tele;
  const t = (focalMm - min) / (max - min);
  return Math.round((lens.maxAperture.wide + t * (lens.maxAperture.tele - lens.maxAperture.wide)) * 10) / 10;
}

function lensFits(body: Body, lens: Lens): boolean {
  return body.fixedLensId ? lens.id === body.fixedLensId : lens.mount !== null && lens.mount === body.mount;
}

/** In A or P mode, or on a body with no M or S mode, the camera picks the shutter speed. */
function cameraPicksShutter(body: Body, mode: ExposureMode): boolean {
  return mode === 'A' || mode === 'P' || !body.modes.some((m) => m === 'M' || m === 'S');
}

/** Fastest timed speed at this aperture (leaf shutters are slower wide open). */
function fastestAt(body: Body, aperture: number | undefined): number {
  let fastest = body.shutter.fastestSeconds;
  if (aperture === undefined) return fastest;
  for (const limit of body.shutter.apertureLimits ?? []) {
    if (aperture < limit.belowAperture) fastest = Math.max(fastest, limit.fastestSeconds);
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
    const widest = maxApertureAt(lens, clamp(s.focalMm ?? lens.focalMm.min, lens.focalMm.min, lens.focalMm.max));
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
    s.aperture = clamp(s.aperture, maxApertureAt(lens, s.focalMm ?? lens.focalMm.min), lens.minAperture);
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
