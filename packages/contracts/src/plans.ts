// Shoot plan shapes shared by the API, web and mobile (refactor 2E-1). A plan keeps only the
// Google place_id or the user's spot id; the place name is fetched fresh when a plan is read.

import { z } from 'zod';

import { SettingsDto } from './gear.ts';
import { PLACE_ID_RE } from './places.ts';

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const ForGoogle = z.object({ placeId: z.string().regex(PLACE_ID_RE), date: DATE.optional() }).strict();
const ForSpot = z.object({ spotId: z.string().uuid(), date: DATE.optional() }).strict();

export const GeneratePlanInput = z.union([ForGoogle, ForSpot]);
export type GeneratePlanInput = z.infer<typeof GeneratePlanInput>;

/** Picks the schema by the body's shape, so errors name the real field (a union would not). */
export function parseGeneratePlanInput(body: unknown) {
  const isSpot = typeof body === 'object' && body !== null && 'spotId' in body && !('placeId' in body);
  return (isSpot ? ForSpot : ForGoogle).safeParse(body) as z.SafeParseReturnType<unknown, GeneratePlanInput>;
}

export const STEP_STATUSES = ['todo', 'done', 'skipped'] as const;
export const PLAN_STATUSES = ['active', 'done', 'archived'] as const;

export const StepPatch = z.object({ status: z.enum(STEP_STATUSES), updatedAt: z.string().datetime({ offset: true }) }).strict();
export type StepPatch = z.infer<typeof StepPatch>;

export const PlanPatch = z.object({ status: z.enum(PLAN_STATUSES) }).strict();
export type PlanPatch = z.infer<typeof PlanPatch>;

export const PlanStepDto = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  title: z.string(),
  instruction: z.string(),
  tip: z.string().nullable(),
  startsAt: z.string().nullable(),
  settings: SettingsDto,
  status: z.enum(STEP_STATUSES),
  updatedAt: z.string(),
});
export type PlanStepDto = z.infer<typeof PlanStepDto>;

export const PlanSummaryDto = z.object({
  id: z.string().uuid(),
  placeSource: z.enum(['google', 'user']),
  placeId: z.string().nullable(),
  spotId: z.string().uuid().nullable(),
  date: DATE,
  timezone: z.string(),
  title: z.string(),
  summary: z.string(),
  loadout: z.object({ body: z.string(), lens: z.string(), film: z.string().nullable() }),
  notes: z.array(z.string()),
  status: z.enum(PLAN_STATUSES),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlanSummaryDto = z.infer<typeof PlanSummaryDto>;

export const ShootPlanDto = PlanSummaryDto.extend({
  placeName: z.string().nullable(),
  placeUnavailable: z.boolean(),
  steps: z.array(PlanStepDto),
});
export type ShootPlanDto = z.infer<typeof ShootPlanDto>;
