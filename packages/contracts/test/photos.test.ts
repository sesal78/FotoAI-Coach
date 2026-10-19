import { expect, test } from 'vitest';

import { ExifInput, PhotoCreateInput } from '../src/index.ts';

const ID = '11111111-2222-4333-8444-555555555555';

test('EXIF fields are all optional and ranged', () => {
  expect(ExifInput.parse({})).toEqual({});
  expect(ExifInput.parse({ cameraMake: 'FUJIFILM', lensModel: 'XF23mmF2.8 R WR', focalMm: 23, aperture: 2.8, shutterSeconds: 0.004, iso: 125, takenAt: '2026-10-19T18:10:00+11:00', takenOffset: '+11:00', lat: -37.8, lng: 144.9 })).toMatchObject({ iso: 125 });
  for (const bad of [{ iso: 0 }, { aperture: -1 }, { lat: 91 }, { takenOffset: '11:00' }, { takenAt: 'yesterday' }, { lensModel: 'x'.repeat(81) }, { extra: 1 }]) {
    expect(ExifInput.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
  }
});

test('a photo needs a client id, a source and a size within 50 MB', () => {
  expect(PhotoCreateInput.parse({ id: ID, source: 'gallery', mime: 'image/jpeg', bytes: 1024 })).toMatchObject({ source: 'gallery' });
  for (const bad of [
    { source: 'gallery', mime: 'image/jpeg', bytes: 1024 },
    { id: ID, source: 'web', mime: 'image/jpeg', bytes: 1024 },
    { id: ID, source: 'gallery', mime: 'text/plain', bytes: 1024 },
    { id: ID, source: 'gallery', mime: 'image/jpeg', bytes: 52_428_801 },
    { id: ID, source: 'gallery', mime: 'image/jpeg', bytes: 1024, userId: ID },
  ]) {
    expect(PhotoCreateInput.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
  }
});
