// Gear and camera-setting shapes shared by the API, web and mobile (refactor 2C).

import { z } from 'zod';

export const EXPOSURE_MODES = ['P', 'A', 'S', 'M'] as const;

export const SettingsDto = z
  .object({
    mode: z.enum(EXPOSURE_MODES),
    aperture: z.number().positive().optional(),
    shutterSeconds: z.number().positive().optional(),
    iso: z.number().int().positive().optional(),
    focalMm: z.number().positive().optional(),
    whiteBalance: z.string().max(40).optional(),
    filmSimulation: z.string().max(40).optional(),
  })
  .strict();

export type SettingsDto = z.infer<typeof SettingsDto>;

export const BodyDto = z.object({
  id: z.string(),
  make: z.string(),
  model: z.string(),
  type: z.enum(['digital', 'film']),
  mount: z.string().nullable(),
  modes: z.array(z.enum(EXPOSURE_MODES)),
  shutter: z.object({
    slowestSeconds: z.number().nullable(),
    fastestSeconds: z.number(),
    bulb: z.boolean().nullable(),
    apertureLimits: z.array(z.object({ belowAperture: z.number(), fastestSeconds: z.number() })).optional(),
  }),
  flashSyncSeconds: z.number().nullable(),
  iso: z.object({ min: z.number(), max: z.number() }).nullable(),
  metering: z.string().nullable(),
  fixedLensId: z.string().nullable(),
  sources: z.array(z.string()),
});

export type BodyDto = z.infer<typeof BodyDto>;

export const LensDto = z.object({
  id: z.string(),
  make: z.string(),
  model: z.string(),
  mount: z.string().nullable(),
  focalMm: z.object({ min: z.number(), max: z.number() }),
  maxAperture: z.object({ wide: z.number(), tele: z.number() }),
  minAperture: z.number(),
  sources: z.array(z.string()),
});

export type LensDto = z.infer<typeof LensDto>;

const name = z.string().trim().min(1).max(80);

/** Custom gear must carry every value the setting checks need. */
export const CustomBodyInput = z
  .object({
    kind: z.literal('body'),
    make: name,
    model: name,
    type: z.enum(['digital', 'film']),
    mount: z.string().trim().min(1).max(40).nullable(),
    modes: z.array(z.enum(EXPOSURE_MODES)).min(1),
    shutter: z
      .object({ slowestSeconds: z.number().positive(), fastestSeconds: z.number().positive(), bulb: z.boolean().optional() })
      .strict()
      .refine((s) => s.slowestSeconds > s.fastestSeconds, 'slowestSeconds must be longer than fastestSeconds'),
    iso: z
      .object({ min: z.number().int().positive(), max: z.number().int().positive() })
      .strict()
      .refine((i) => i.min <= i.max, 'iso.min must not exceed iso.max'),
  })
  .strict();

export const CustomLensInput = z
  .object({
    kind: z.literal('lens'),
    make: name,
    model: name,
    mount: z.string().trim().min(1).max(40),
    focalMm: z.object({ min: z.number().positive(), max: z.number().positive() }).strict().refine((f) => f.min <= f.max, 'focalMm.min must not exceed focalMm.max'),
    maxAperture: z.object({ wide: z.number().positive(), tele: z.number().positive() }).strict(),
    minAperture: z.number().positive(),
  })
  .strict()
  .refine((l) => l.minAperture > l.maxAperture.tele && l.maxAperture.wide <= l.maxAperture.tele, 'aperture range is not possible');

export const AddGearInput = z.union([
  z.object({ catalogId: z.string().regex(/^[a-z0-9-]+$/) }).strict(),
  z.object({ custom: z.union([CustomBodyInput, CustomLensInput]) }).strict(),
]);

export type AddGearInput = z.infer<typeof AddGearInput>;

export const GearItem = z.object({
  id: z.string().uuid(),
  kind: z.enum(['body', 'lens', 'other']),
  catalogId: z.string().nullable(),
  name: z.string(),
  capability: z.union([BodyDto, LensDto]).nullable(),
});

export type GearItem = z.infer<typeof GearItem>;

export const FilmLoadDto = z
  .object({ stock: z.string().trim().min(1).max(60), boxIso: z.number().int().positive(), ratedIso: z.number().int().positive().optional() })
  .strict();

export const LoadoutInput = z
  .object({ bodyGearId: z.string().uuid(), lensGearId: z.string().uuid().optional(), film: FilmLoadDto.optional() })
  .strict();

export type LoadoutInput = z.infer<typeof LoadoutInput>;

export const LoadoutDto = z.object({
  body: GearItem,
  lensGearId: z.string().uuid().nullable(),
  lens: LensDto,
  film: FilmLoadDto.nullable(),
});

export type LoadoutDto = z.infer<typeof LoadoutDto>;
