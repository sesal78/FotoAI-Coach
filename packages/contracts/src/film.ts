// Film roll and frame shapes shared by the API, web and mobile (refactor 2E-2a). Ids come from
// the phone, so an offline write replayed later is a no-op that returns the stored record.

import { z } from 'zod';

import { SettingsDto } from './gear.ts';

export const ROLL_STATUSES = ['loaded', 'finished', 'developed', 'scanned'] as const;

const id = z.string().uuid();
const iso = z.number().int().positive();

export const RollInput = z
  .object({
    id,
    stockId: z.string().regex(/^[a-z0-9-]{1,60}$/).optional(),
    stockName: z.string().trim().min(1).max(60).optional(),
    boxIso: iso.optional(),
    ratedIso: iso.optional(),
    exposures: z.number().int().min(1).max(72),
    bodyGearId: id,
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine((r) => r.stockId !== undefined || (r.stockName !== undefined && r.boxIso !== undefined), {
    message: 'Give a known stockId, or a stockName with boxIso',
    path: ['stockId'],
  });
export type RollInput = z.infer<typeof RollInput>;

export const RollPatch = z.object({ status: z.enum(ROLL_STATUSES) }).strict();
export type RollPatch = z.infer<typeof RollPatch>;

export const FrameInput = z
  .object({
    id,
    frameNo: z.number().int().min(1).max(74),
    settings: SettingsDto,
    lensGearId: id.optional(),
    stepId: id.optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    note: z.string().trim().max(500).optional(),
    shotAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type FrameInput = z.infer<typeof FrameInput>;

export const FrameDto = z.object({
  id,
  frameNo: z.number().int(),
  settings: SettingsDto,
  lensGearId: id.nullable(),
  stepId: id.nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  note: z.string().nullable(),
  shotAt: z.string(),
  createdAt: z.string(),
});
export type FrameDto = z.infer<typeof FrameDto>;

export const RollDto = z.object({
  id,
  stockId: z.string().nullable(),
  stockName: z.string(),
  boxIso: z.number().int(),
  ratedIso: z.number().int(),
  exposures: z.number().int(),
  bodyGearId: id.nullable(),
  status: z.enum(ROLL_STATUSES),
  loadedAt: z.string(),
  finishedAt: z.string().nullable(),
  notes: z.string().nullable(),
  framesLogged: z.number().int(),
  framesLeft: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RollDto = z.infer<typeof RollDto>;

export const ScanMatchInput = z
  .object({
    photoIds: z.array(id).min(1).max(80).refine((ids) => new Set(ids).size === ids.length, 'photoIds must be unique'),
    overrides: z.record(id, z.number().int().min(1).max(74)).optional(),
  })
  .strict();
export type ScanMatchInput = z.infer<typeof ScanMatchInput>;
