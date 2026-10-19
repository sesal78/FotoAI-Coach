import { expect, test } from 'vitest';

import { parseGeneratePlanInput, PlanPatch, StepPatch } from '../src/index.ts';

const PLACE = 'ChIJ0T2NLmJC1moRbU6M9oX9mWQ';
const SPOT = '11111111-2222-4333-8444-555555555555';

test('a plan is generated for a Google place or a saved spot, not both', () => {
  expect(parseGeneratePlanInput({ placeId: PLACE })).toEqual({ success: true, data: { placeId: PLACE } });
  expect(parseGeneratePlanInput({ spotId: SPOT, date: '2026-10-18' })).toEqual({ success: true, data: { spotId: SPOT, date: '2026-10-18' } });
  for (const bad of [{ placeId: PLACE, spotId: SPOT }, {}, { spotId: 'x' }, { placeId: PLACE, date: '18/10/2026' }, { placeId: PLACE, userId: SPOT }]) {
    expect(parseGeneratePlanInput(bad).success, JSON.stringify(bad)).toBe(false);
  }
});

test('a step patch needs a status and an ISO updatedAt', () => {
  expect(StepPatch.parse({ status: 'done', updatedAt: '2026-10-18T09:00:00.000Z' })).toMatchObject({ status: 'done' });
  for (const bad of [{ status: 'done' }, { status: 'finished', updatedAt: '2026-10-18T09:00:00Z' }, { status: 'done', updatedAt: 'yesterday' }, { status: 'done', updatedAt: '2026-10-18T09:00:00Z', extra: 1 }]) {
    expect(StepPatch.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
  }
  expect(PlanPatch.safeParse({ status: 'archived' }).success).toBe(true);
  expect(PlanPatch.safeParse({ status: 'deleted' }).success).toBe(false);
});
