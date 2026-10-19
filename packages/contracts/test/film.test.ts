import { expect, test } from 'vitest';

import { FrameInput, RollInput, RollPatch } from '../src/index.ts';

const ID = '11111111-2222-4333-8444-555555555555';

test('a roll needs a known stock or a name and ISO', () => {
  expect(RollInput.parse({ id: ID, stockId: 'kodak-portra-400', exposures: 36, bodyGearId: ID })).toMatchObject({ stockId: 'kodak-portra-400' });
  expect(RollInput.parse({ id: ID, stockName: 'Expired Agfa', boxIso: 200, exposures: 24, bodyGearId: ID })).toMatchObject({ boxIso: 200 });
  for (const bad of [
    { id: ID, exposures: 36, bodyGearId: ID },
    { id: ID, stockName: 'Agfa', exposures: 36, bodyGearId: ID },
    { id: ID, stockId: 'Bad Id', exposures: 36, bodyGearId: ID },
    { id: ID, stockId: 'kodak-portra-400', exposures: 0, bodyGearId: ID },
    { id: 'x', stockId: 'kodak-portra-400', exposures: 36, bodyGearId: ID },
    { id: ID, stockId: 'kodak-portra-400', exposures: 36, bodyGearId: ID, userId: ID },
  ]) {
    expect(RollInput.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
  }
  expect(RollPatch.safeParse({ status: 'developed' }).success).toBe(true);
  expect(RollPatch.safeParse({ status: 'lost' }).success).toBe(false);
});

test('a frame needs a client id, a frame number and a shot time', () => {
  const frame = { id: ID, frameNo: 1, settings: { mode: 'A', aperture: 8 }, shotAt: '2026-10-19T18:10:00+11:00' };
  expect(FrameInput.parse(frame)).toMatchObject({ frameNo: 1 });
  for (const bad of [{ ...frame, id: undefined }, { ...frame, frameNo: 0 }, { ...frame, shotAt: 'now' }, { ...frame, note: 'x'.repeat(501) }, { ...frame, lat: 91 }]) {
    expect(FrameInput.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
  }
});
