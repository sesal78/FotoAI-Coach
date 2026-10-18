// Sun and moon times for a place and a day, in the place's own time zone. Golden hour is the
// sun between +6° and −4°; blue hour is −4° to −8°. A time that does not happen that day
// (polar day or night) is null, and a window with a missing edge is null as a whole.

import * as SunCalc from 'suncalc';

import { localDate, offsetMinutes, timezoneAt, toZonedIso } from './zoned.ts';

export type Window = { start: string; end: string } | null;

export interface LightTimes {
  date: string;
  timezone: string;
  sunrise: string | null;
  sunset: string | null;
  solarNoon: string;
  goldenMorning: Window;
  goldenEvening: Window;
  blueMorning: Window;
  blueEvening: Window;
  moonrise: string | null;
  moonset: string | null;
  moonIllumination: number;
  sunAlwaysUp: boolean;
  sunAlwaysDown: boolean;
}

// Once, at module load. suncalc names the morning crossing first, the evening one second.
SunCalc.addTime(-4, 'fotoaiGoldenMorningStart', 'fotoaiGoldenEveningEnd');
SunCalc.addTime(-8, 'fotoaiBlueMorningStart', 'fotoaiBlueEveningEnd');

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(date: string): { y: number; m: number; d: number } {
  const match = DATE.exec(date);
  if (!match) throw new RangeError(`date must be YYYY-MM-DD: ${date}`);
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new RangeError(`date does not exist: ${date}`);
  }
  return { y, m, d };
}

function checkPoint(lat: number, lng: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new RangeError('lat must be within -90..90');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) throw new RangeError('lng must be within -180..180');
}

/** The instant of local noon on that date in that zone (the offset is taken at noon itself). */
function localNoon(date: string, timeZone: string): { noon: Date; offset: number } {
  const { y, m, d } = parseDate(date);
  const guess = Date.UTC(y, m - 1, d, 12);
  const offset = offsetMinutes(new Date(guess - offsetMinutes(new Date(guess), timeZone) * 60_000), timeZone);
  return { noon: new Date(guess - offset * 60_000), offset };
}

export function lightTimes(lat: number, lng: number, date?: string): LightTimes {
  checkPoint(lat, lng);
  const timezone = timezoneAt(lat, lng);
  const day = date ?? localDate(new Date(), timezone);
  const { noon, offset } = localNoon(day, timezone);

  const sun = SunCalc.getTimes(noon, lat, lng, 0, offset);
  const moon = SunCalc.getMoonTimes(noon, lat, lng, offset);
  const at = (value: unknown): string | null => (value instanceof Date ? toZonedIso(value, timezone) : null);
  const window = (start: unknown, end: unknown): Window => {
    const [s, e] = [at(start), at(end)];
    return s && e ? { start: s, end: e } : null;
  };

  return {
    date: day,
    timezone,
    sunrise: at(sun.sunrise),
    sunset: at(sun.sunset),
    solarNoon: toZonedIso(sun.solarNoon, timezone),
    goldenMorning: window(sun.fotoaiGoldenMorningStart, sun.goldenHourEnd),
    goldenEvening: window(sun.goldenHour, sun.fotoaiGoldenEveningEnd),
    blueMorning: window(sun.fotoaiBlueMorningStart, sun.fotoaiGoldenMorningStart),
    blueEvening: window(sun.fotoaiGoldenEveningEnd, sun.fotoaiBlueEveningEnd),
    moonrise: at(moon.rise),
    moonset: at(moon.set),
    moonIllumination: Math.round(SunCalc.getMoonIllumination(noon).fraction * 100) / 100,
    sunAlwaysUp: sun.alwaysUp === true,
    sunAlwaysDown: sun.alwaysDown === true,
  };
}
