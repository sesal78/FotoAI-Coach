// App preferences shared by the API, web and mobile (refactor 2B).

import { z } from 'zod';

export const THEMES = ['golden', 'golden_dark', 'camera'] as const;
export const UNITS = ['metric', 'imperial'] as const;

export type Theme = (typeof THEMES)[number];
export type Units = (typeof UNITS)[number];

const Home = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    label: z.string().trim().max(120).nullable().optional(),
  })
  .strict();

export const Preferences = z.object({
  theme: z.enum(THEMES),
  units: z.enum(UNITS),
  home: z.object({ lat: z.number(), lng: z.number(), label: z.string().nullable() }).nullable(),
});

export type Preferences = z.infer<typeof Preferences>;

/** Any subset; `home: null` clears the home area. Unknown keys are rejected. */
export const PreferencesPatch = z
  .object({
    theme: z.enum(THEMES).optional(),
    units: z.enum(UNITS).optional(),
    home: Home.nullable().optional(),
  })
  .strict();

export type PreferencesPatch = z.infer<typeof PreferencesPatch>;
