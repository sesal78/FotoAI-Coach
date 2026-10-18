import { expect, test } from 'vitest';

import { framesLeft, nearestShutter, pushPullStops, sunny16 } from '../src/index.ts';

test('sunny 16: ISO 400 in full sun is f/16 at 1/500', () => {
  expect(sunny16('full_sun', 400)).toEqual({ aperture: 16, shutterSeconds: 1 / 500 });
});

test('sunny 16: ISO 100 overcast is f/8 at 1/125', () => {
  expect(sunny16('overcast', 100)).toEqual({ aperture: 8, shutterSeconds: 1 / 125 });
});

test('golden hour needs 3 stops more light than full sun', () => {
  expect(sunny16('golden_hour', 400)).toEqual({ aperture: 5.6, shutterSeconds: 1 / 500 });
});

test('blue hour has no fixed rule: meter, then bracket', () => {
  expect(sunny16('blue_hour', 400)).toBeNull();
});

test('every daylight scene maps to its classic aperture', () => {
  const expected = { snow_sand: 22, full_sun: 16, slight_overcast: 11, overcast: 8, heavy_overcast: 5.6, open_shade: 5.6 } as const;
  for (const [scene, aperture] of Object.entries(expected)) {
    expect(sunny16(scene as keyof typeof expected, 100)?.aperture, scene).toBe(aperture);
  }
});

test('shutter speeds snap to the nearest standard speed in stops', () => {
  expect(nearestShutter(1 / 400)).toBe(1 / 500);
  expect(nearestShutter(1 / 60)).toBe(1 / 60);
  expect(nearestShutter(1 / 200)).toBe(1 / 250);
  expect(nearestShutter(3)).toBe(4);
});

test('frames left never goes below zero', () => {
  expect(framesLeft({ exposures: 36, framesLogged: 7 })).toBe(29);
  expect(framesLeft({ exposures: 36, framesLogged: 40 })).toBe(0);
});

test('push and pull in stops, rounded to a third', () => {
  expect(pushPullStops(400, 1600)).toBe(2);
  expect(pushPullStops(400, 200)).toBe(-1);
  expect(pushPullStops(400, 400)).toBe(0);
  expect(pushPullStops(100, 125)).toBeCloseTo(1 / 3, 5);
});
