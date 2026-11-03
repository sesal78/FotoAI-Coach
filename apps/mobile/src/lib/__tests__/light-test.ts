import type { LightTimesDto } from '@fotoai/contracts';

import { clockOf, dayArc, isNight, nextGoodLight } from '../light';

// Melbourne, 20 Oct 2026 (+11:00).
const LIGHT: LightTimesDto = {
  date: '2026-10-20',
  timezone: 'Australia/Melbourne',
  sunrise: '2026-10-20T06:28:00+11:00',
  sunset: '2026-10-20T19:41:00+11:00',
  solarNoon: '2026-10-20T13:04:00+11:00',
  blueMorning: { start: '2026-10-20T05:50:00+11:00', end: '2026-10-20T06:10:00+11:00' },
  goldenMorning: { start: '2026-10-20T06:10:00+11:00', end: '2026-10-20T06:55:00+11:00' },
  goldenEvening: { start: '2026-10-20T19:05:00+11:00', end: '2026-10-20T19:58:00+11:00' },
  blueEvening: { start: '2026-10-20T19:58:00+11:00', end: '2026-10-20T20:20:00+11:00' },
  moonrise: null,
  moonset: null,
  moonIllumination: 0.4,
  sunAlwaysUp: false,
  sunAlwaysDown: false,
};

const at = (local: string) => new Date(`2026-10-20T${local}:00+11:00`);

test('the window on now is phase now', () => {
  expect(nextGoodLight(LIGHT, at('19:30'))).toEqual({ kind: 'golden', phase: 'now', start: LIGHT.goldenEvening!.start, end: LIGHT.goldenEvening!.end });
});

test('before dawn the next window is blue morning', () => {
  expect(nextGoodLight(LIGHT, at('05:00'))).toMatchObject({ kind: 'blue', phase: 'next', start: LIGHT.blueMorning!.start });
});

test('after golden evening the next is blue evening', () => {
  expect(nextGoodLight(LIGHT, at('19:58'))).toMatchObject({ kind: 'blue', phase: 'now' });
  expect(nextGoodLight(LIGHT, at('12:00'))).toMatchObject({ kind: 'golden', phase: 'next', start: LIGHT.goldenEvening!.start });
});

test('after the last window the answer is null', () => {
  expect(nextGoodLight(LIGHT, at('21:00'))).toBeNull();
});

test('a polar day has no windows', () => {
  const polar = { ...LIGHT, sunAlwaysUp: true, sunrise: null, sunset: null, blueMorning: null, goldenMorning: null, goldenEvening: null, blueEvening: null };
  expect(nextGoodLight(polar, at('12:00'))).toBeNull();
});

test("clockOf keeps the place's clock, not the phone's", () => {
  expect(clockOf('2026-10-20T19:41:00+11:00')).toBe('19:41');
  expect(clockOf('2026-10-20T05:07:59-04:00')).toBe('05:07');
});

test('night is from sunset to sunrise, always in a polar night, never in a polar day', () => {
  expect(isNight(LIGHT, at('06:27'))).toBe(true);
  expect(isNight(LIGHT, at('06:28'))).toBe(false);
  expect(isNight(LIGHT, at('19:40'))).toBe(false);
  expect(isNight(LIGHT, at('19:41'))).toBe(true);
  const nulls = { sunrise: null, sunset: null, blueMorning: null, goldenMorning: null, goldenEvening: null, blueEvening: null };
  expect(isNight({ ...LIGHT, ...nulls, sunAlwaysDown: true }, at('12:00'))).toBe(true);
  expect(isNight({ ...LIGHT, ...nulls, sunAlwaysUp: true }, at('00:30'))).toBe(false);
});

test('the sun path runs from blue morning to blue evening, with each window and the sun on it', () => {
  const arc = dayArc(LIGHT, at('13:05'))!;
  expect(arc.from).toBe(LIGHT.blueMorning!.start);
  expect(arc.to).toBe(LIGHT.blueEvening!.end);
  expect(arc.windows.map((w) => w.kind)).toEqual(['blue', 'golden', 'golden', 'blue']);
  expect(arc.windows[0]!.start).toBe(0);
  expect(arc.windows[3]!.end).toBe(1);
  // 05:50 to 20:20 is 870 minutes; golden evening starts at 19:05 (795 minutes in).
  expect(arc.windows[2]!.start).toBeCloseTo(795 / 870);
  expect(arc.sun).toBeCloseTo(435 / 870);
  expect(dayArc(LIGHT, at('05:30'))!.sun).toBeNull();
  expect(dayArc(LIGHT, at('21:00'))!.sun).toBeNull();
});

test('with no blue windows the sun path runs sunrise to sunset; a polar day has none', () => {
  expect(dayArc({ ...LIGHT, blueMorning: null, blueEvening: null }, at('12:00'))!.from).toBe(LIGHT.sunrise);
  const polar = { ...LIGHT, sunAlwaysUp: true, sunrise: null, sunset: null, blueMorning: null, goldenMorning: null, goldenEvening: null, blueEvening: null };
  expect(dayArc(polar, at('12:00'))).toBeNull();
});
