import { expect, test } from 'vitest';

import { parseSpotInput, SpotPatch } from '../src/index.ts';

const PLACE = 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ';

test('a spot is a Google place id or a named pin, not both', () => {
  expect(parseSpotInput({ placeId: PLACE })).toEqual({ success: true, data: { placeId: PLACE } });
  expect(parseSpotInput({ pin: { name: ' Lookout ', lat: -37.88, lng: 144.98 }, notes: 'bay' })).toMatchObject({
    success: true,
    data: { pin: { name: 'Lookout' }, notes: 'bay' },
  });
  expect(parseSpotInput({ placeId: PLACE, pin: { name: 'x', lat: 0, lng: 0 } }).success).toBe(false);
  expect(parseSpotInput({ placeId: 'bad id!' }).success).toBe(false);
  expect(parseSpotInput({}).success).toBe(false);
});

test('a pin outside the coordinate ranges is rejected, naming the field', () => {
  const bad = parseSpotInput({ pin: { name: 'x', lat: 91, lng: 0 } });
  expect(bad.success).toBe(false);
  expect(JSON.stringify(bad.success ? null : bad.error.issues)).toContain('lat');
  expect(parseSpotInput({ pin: { name: '', lat: 0, lng: 0 } }).success).toBe(false);
  expect(parseSpotInput({ pin: { name: 'x'.repeat(81), lat: 0, lng: 0 } }).success).toBe(false);
});

test('a patch changes notes, favourite or name, and nothing else', () => {
  expect(SpotPatch.parse({ notes: null })).toEqual({ notes: null });
  expect(SpotPatch.safeParse({}).success).toBe(false);
  expect(SpotPatch.safeParse({ placeId: PLACE }).success).toBe(false);
  expect(SpotPatch.safeParse({ notes: 'x'.repeat(2001) }).success).toBe(false);
});
