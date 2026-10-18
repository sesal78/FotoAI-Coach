// Light and weather shapes shared by the API, web and mobile (refactor 2D). Times are ISO 8601
// strings with the place's UTC offset, such as 2026-10-18T19:41:10+11:00.

import { z } from 'zod';

const ZonedTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
const Window = z.object({ start: ZonedTime, end: ZonedTime }).nullable();

export const LightTimesDto = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1),
  sunrise: ZonedTime.nullable(),
  sunset: ZonedTime.nullable(),
  solarNoon: ZonedTime,
  goldenMorning: Window,
  goldenEvening: Window,
  blueMorning: Window,
  blueEvening: Window,
  moonrise: ZonedTime.nullable(),
  moonset: ZonedTime.nullable(),
  moonIllumination: z.number().min(0).max(1),
  sunAlwaysUp: z.boolean(),
  sunAlwaysDown: z.boolean(),
});

export type LightTimesDto = z.infer<typeof LightTimesDto>;

export const CONDITIONS = ['clear', 'partly_cloudy', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'thunder', 'unknown'] as const;
export type Condition = (typeof CONDITIONS)[number];

const Reading = z.object({
  time: ZonedTime,
  temperatureC: z.number(),
  cloudPct: z.number().min(0).max(100),
  precipitationMm: z.number().min(0).nullable(),
  condition: z.enum(CONDITIONS),
});

export const WeatherDto = z.object({
  source: z.enum(['open-meteo', 'met-norway']),
  attribution: z.string().min(1),
  fetchedAt: ZonedTime,
  timezone: z.string().min(1),
  current: Reading.extend({ windKph: z.number().min(0), humidityPct: z.number().min(0).max(100).nullable() }),
  hourly: z.array(Reading).max(24),
});

export type WeatherDto = z.infer<typeof WeatherDto>;
