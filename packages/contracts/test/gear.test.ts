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
