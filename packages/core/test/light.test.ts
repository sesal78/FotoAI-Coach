import { afterEach, expect, test, vi } from 'vitest';

import { lightTimes, localDate, timezoneAt, toZonedIso } from '../src/index.ts';

const minutesApart = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 60_000;
const offsetOf = (iso: string) => iso.slice(-6);

afterEach(() => {
  vi.useRealTimers();
});

test('Melbourne CBD on 18 Oct 2026 matches the reference within 2 minutes', () => {
  const t = lightTimes(-37.8136, 144.9631, '2026-10-18');
  expect(t.timezone).toBe('Australia/Melbourne');
  expect(t.date).toBe('2026-10-18');
  expect(minutesApart(t.sunrise!, '2026-10-18T06:29:34+11:00')).toBeLessThanOrEqual(2);
  expect(minutesApart(t.sunset!, '2026-10-18T19:41:10+11:00')).toBeLessThanOrEqual(2);
  expect(offsetOf(t.sunset!)).toBe('+11:00');
});

test('the evening runs golden, then sunset, then blue, in order', () => {
  const t = lightTimes(-37.8136, 144.9631, '2026-10-18');
  const ms = (iso: string) => Date.parse(iso);
  expect(ms(t.goldenEvening!.start)).toBeLessThan(ms(t.sunset!));
  expect(ms(t.sunset!)).toBeLessThan(ms(t.goldenEvening!.end));
  expect(t.goldenEvening!.end).toBe(t.blueEvening!.start);
  expect(ms(t.blueEvening!.start)).toBeLessThan(ms(t.blueEvening!.end));
  // The morning mirrors it: blue, then golden across sunrise.
  expect(t.blueMorning!.end).toBe(t.goldenMorning!.start);
  expect(ms(t.goldenMorning!.start)).toBeLessThan(ms(t.sunrise!));
  expect(ms(t.sunrise!)).toBeLessThan(ms(t.goldenMorning!.end));
  expect(t.moonIllumination).toBeGreaterThanOrEqual(0);
  expect(t.moonIllumination).toBeLessThanOrEqual(1);
});

test('times carry the offset of the day itself across a DST change', () => {
  // Melbourne DST ends on Sunday 4 Apr 2027.
  expect(offsetOf(lightTimes(-37.8136, 144.9631, '2027-04-03').sunset!)).toBe('+11:00');
  expect(offsetOf(lightTimes(-37.8136, 144.9631, '2027-04-05').sunset!)).toBe('+10:00');
  expect(lightTimes(-37.8136, 144.9631, '2027-04-05').sunset!.startsWith('2027-04-05T')).toBe(true);
});

test('polar day in Tromsø gives null sun times, not an exception', () => {
  const t = lightTimes(69.6492, 18.9553, '2026-06-21');
  expect(t).toMatchObject({ sunrise: null, sunset: null, sunAlwaysUp: true, sunAlwaysDown: false, goldenEvening: null });
  expect(t.timezone).toBe('Europe/Oslo');
});

test('the default date is today in the place, not on the server', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-18T14:00:00Z'));
  expect(lightTimes(-37.8136, 144.9631).date).toBe('2026-10-19');
  expect(lightTimes(51.5072, -0.1276).date).toBe('2026-10-18');
});

test('bad coordinates and dates throw RangeError', () => {
  expect(() => lightTimes(91, 0)).toThrow(RangeError);
  expect(() => lightTimes(0, -181)).toThrow(RangeError);
  expect(() => lightTimes(Number.NaN, 0)).toThrow(RangeError);
  expect(() => lightTimes(0, 0, '2026-13-01')).toThrow(RangeError);
  expect(() => lightTimes(0, 0, '2026-02-30')).toThrow(RangeError);
  expect(() => lightTimes(0, 0, '18/10/2026')).toThrow(RangeError);
});

test('timezoneAt and toZonedIso agree on a known instant', () => {
  const zone = timezoneAt(-37.8136, 144.9631);
  expect(toZonedIso(new Date('2026-10-18T08:41:10Z'), zone)).toBe('2026-10-18T19:41:10+11:00');
  expect(toZonedIso(new Date('2026-10-18T08:41:10.900Z'), 'UTC')).toBe('2026-10-18T08:41:10+00:00');
  expect(localDate(new Date('2026-10-18T14:00:00Z'), zone)).toBe('2026-10-19');
});
