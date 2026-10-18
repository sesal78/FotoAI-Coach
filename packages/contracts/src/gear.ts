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
