import { expect, test } from 'vitest';

import { PreferencesPatch, THEMES, UNITS } from '../src/index.ts';

test('themes and units match the database checks', () => {
  expect(THEMES).toEqual(['golden', 'golden_dark', 'camera']);
  expect(UNITS).toEqual(['metric', 'imperial']);
});

test('a patch may set any subset, and home null clears the home area', () => {
  expect(PreferencesPatch.parse({ theme: 'camera' })).toEqual({ theme: 'camera' });
  expect(PreferencesPatch.parse({ home: { lat: -37.8, lng: 144.97, label: 'Melbourne CBD' } }).home).toEqual({
    lat: -37.8,
    lng: 144.97,
    label: 'Melbourne CBD',
  });
  expect(PreferencesPatch.parse({ home: null })).toEqual({ home: null });
});

test('a patch rejects unknown themes, out-of-range coordinates and unknown keys', () => {
  for (const bad of [
    { theme: 'neon' },
    { units: 'kelvin' },
    { home: { lat: 91, lng: 0 } },
    { home: { lat: 0, lng: -181 } },
    { home: { lat: 0 } },
    { userId: 'x' },
    { favourite: 'x' },
  ]) {
    expect(() => PreferencesPatch.parse(bad), JSON.stringify(bad)).toThrow();
  }
});
