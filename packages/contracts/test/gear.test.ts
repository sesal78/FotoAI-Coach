import { expect, test } from 'vitest';

import { EXPOSURE_MODES, SettingsDto } from '../src/index.ts';

test('exposure modes are P, A, S and M', () => {
  expect(EXPOSURE_MODES).toEqual(['P', 'A', 'S', 'M']);
});

test('settings accept a full Fujifilm step and reject impossible values', () => {
  expect(SettingsDto.parse({ mode: 'A', aperture: 8, iso: 125, focalMm: 24, filmSimulation: 'Classic Chrome' })).toMatchObject({ mode: 'A' });
  for (const bad of [{ mode: 'X' }, { mode: 'A', aperture: -2 }, { mode: 'M', shutterSeconds: 0 }, { mode: 'A', iso: 0 }, { mode: 'A', extra: 1 }]) {
    expect(() => SettingsDto.parse(bad), JSON.stringify(bad)).toThrow();
  }
});

import { AddGearInput, LoadoutInput } from '../src/index.ts';

const customBody = {
  kind: 'body', make: 'Olympus', model: 'OM-1', type: 'film', mount: 'OM', modes: ['M'],
  shutter: { slowestSeconds: 1, fastestSeconds: 1 / 1000, bulb: true }, iso: { min: 25, max: 1600 },
};

test('gear is added from the catalog or as complete custom gear', () => {
  expect(AddGearInput.parse({ catalogId: 'nikon-fe2' })).toEqual({ catalogId: 'nikon-fe2' });
  expect(AddGearInput.parse({ custom: customBody })).toMatchObject({ custom: { kind: 'body' } });
  expect(() => AddGearInput.parse({ catalogId: 'nikon-fe2', custom: customBody })).toThrow();
});

test('custom gear missing the shutter range is rejected, naming the field', () => {
  const noShutter: Record<string, unknown> = { ...customBody };
  delete noShutter.shutter;
  const result = AddGearInput.safeParse({ custom: noShutter });
  expect(result.success).toBe(false);
  expect(JSON.stringify(result.error?.issues)).toContain('shutter');
});

test('a loadout needs a body gear id; lens and film are optional', () => {
  const id = '11111111-2222-4333-8444-555555555555';
  expect(LoadoutInput.parse({ bodyGearId: id })).toEqual({ bodyGearId: id });
  expect(LoadoutInput.parse({ bodyGearId: id, lensGearId: id, film: { stock: 'Portra 400', boxIso: 400 } })).toMatchObject({ film: { boxIso: 400 } });
  for (const bad of [{}, { bodyGearId: 'x' }, { bodyGearId: id, film: { stock: 'x', boxIso: 0 } }, { bodyGearId: id, userId: id }]) {
    expect(() => LoadoutInput.parse(bad), JSON.stringify(bad)).toThrow();
  }
});
