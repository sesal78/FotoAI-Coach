// Turns the custom-gear form's text fields into the contract's CustomBodyInput or CustomLensInput,
// with one plain message per field. The contract schema makes the final call, so the phone and
// the server agree on what is valid.

import { CustomBodyInput, CustomLensInput, EXPOSURE_MODES } from '@fotoai/contracts';
import type { z } from 'zod';

export type Mode = (typeof EXPOSURE_MODES)[number];

export interface CustomGearForm {
  kind: 'body' | 'lens';
  make: string;
  model: string;
  mount: string;
  type: 'digital' | 'film';
  modes: Mode[];
  slowest: string;
  fastest: string;
  isoMin: string;
  isoMax: string;
  focalMin: string;
  focalMax: string;
  apertureWide: string;
  apertureTele: string;
  minAperture: string;
}

export const EMPTY_FORM: CustomGearForm = {
  kind: 'body',
  make: '',
  model: '',
  mount: '',
  type: 'digital',
  modes: ['P', 'A', 'S', 'M'],
  slowest: '',
  fastest: '',
  isoMin: '',
  isoMax: '',
  focalMin: '',
  focalMax: '',
  apertureWide: '',
  apertureTele: '',
  minAperture: '',
};

export const LABELS: Record<Exclude<keyof CustomGearForm, 'kind' | 'type'>, string> = {
  make: 'Make',
  model: 'Model',
  mount: 'Mount',
  modes: 'Exposure modes',
  slowest: 'Slowest shutter (seconds)',
  fastest: 'Fastest shutter (seconds, such as 1/4000)',
  isoMin: 'Lowest ISO',
  isoMax: 'Highest ISO',
  focalMin: 'Shortest focal length (mm)',
  focalMax: 'Longest focal length (mm)',
  apertureWide: 'Widest aperture at the short end (f/)',
  apertureTele: 'Widest aperture at the long end (f/)',
  minAperture: 'Smallest aperture (f/)',
};

type FieldName = keyof typeof LABELS | 'form';
export type GearErrors = Partial<Record<FieldName, string>>;

/** "1/4000", "0.5", "2,8" → a number; anything else → NaN. */
export function parseNumber(text: string): number {
  const t = text.trim().replace(',', '.');
  const fraction = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(t);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return t === '' ? NaN : Number(t);
}

const BODY_FIELDS = ['make', 'model', 'mount', 'slowest', 'fastest', 'isoMin', 'isoMax'] as const;
const LENS_FIELDS = ['make', 'model', 'mount', 'focalMin', 'focalMax', 'apertureWide', 'apertureTele', 'minAperture'] as const;
const NUMERIC = new Set(['slowest', 'fastest', 'isoMin', 'isoMax', 'focalMin', 'focalMax', 'apertureWide', 'apertureTele', 'minAperture']);

// Where a contract issue shows in the form.
const BODY_PATH: Record<string, FieldName> = { shutter: 'slowest', iso: 'isoMin', modes: 'modes' };
const LENS_PATH: Record<string, FieldName> = { focalMm: 'focalMin', maxAperture: 'apertureWide' };

export function toCustomInput(f: CustomGearForm): { input: z.infer<typeof CustomBodyInput> | z.infer<typeof CustomLensInput> } | { errors: GearErrors } {
  const errors: GearErrors = {};
  for (const name of f.kind === 'body' ? BODY_FIELDS : LENS_FIELDS) {
    const value = f[name];
    if (!value.trim()) errors[name] = `${LABELS[name].replace(/ \(.*\)$/, '')} is required`;
    else if (NUMERIC.has(name) && !(parseNumber(value) > 0)) errors[name] = `${LABELS[name].replace(/ \(.*\)$/, '')} must be a number above 0`;
  }
  if (f.kind === 'body' && f.modes.length === 0) errors.modes = 'Choose at least one exposure mode';
  if (Object.keys(errors).length > 0) return { errors };

  const n = (s: string) => parseNumber(s);
  const parsed =
    f.kind === 'body'
      ? CustomBodyInput.safeParse({
          kind: 'body',
          make: f.make.trim(),
          model: f.model.trim(),
          type: f.type,
          mount: f.mount.trim(),
          modes: f.modes,
          shutter: { slowestSeconds: n(f.slowest), fastestSeconds: n(f.fastest) },
          iso: { min: Math.round(n(f.isoMin)), max: Math.round(n(f.isoMax)) },
        })
      : CustomLensInput.safeParse({
          kind: 'lens',
          make: f.make.trim(),
          model: f.model.trim(),
          mount: f.mount.trim(),
          focalMm: { min: n(f.focalMin), max: n(f.focalMax) },
          maxAperture: { wide: n(f.apertureWide), tele: n(f.apertureTele) },
          minAperture: n(f.minAperture),
        });
  if (parsed.success) return { input: parsed.data };
  const map = f.kind === 'body' ? BODY_PATH : LENS_PATH;
  for (const issue of parsed.error.issues) {
    const head = String(issue.path[0] ?? '');
    const field: FieldName = map[head] ?? (head in LABELS ? (head as FieldName) : 'form');
    errors[field] ??= issue.message;
  }
  return { errors };
}
