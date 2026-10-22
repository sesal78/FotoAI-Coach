// The next good light for Today, from the day's light times. Pure: no clock, no timezone library.
// Times are ISO strings in the place's own clock with its offset, so the clock part is shown as is.

import type { LightTimesDto } from '@fotoai/contracts';

export type LightKind = 'golden' | 'blue';

export interface GoodLight {
  kind: LightKind;
  phase: 'now' | 'next';
  start: string;
  end: string;
}

/** The golden or blue window on now, else the next one today, else null. */
export function nextGoodLight(light: LightTimesDto, now: Date): GoodLight | null {
  const windows = (
    [
      ['blue', light.blueMorning],
      ['golden', light.goldenMorning],
      ['golden', light.goldenEvening],
      ['blue', light.blueEvening],
    ] as const
  )
    .filter((w): w is readonly [LightKind, { start: string; end: string }] => w[1] !== null)
    .map(([kind, w]) => ({ kind, start: w.start, end: w.end, from: Date.parse(w.start), to: Date.parse(w.end) }))
    .sort((a, b) => a.from - b.from);
  const t = now.getTime();
  const on = windows.find((w) => w.from <= t && t < w.to);
  if (on) return { kind: on.kind, phase: 'now', start: on.start, end: on.end };
  const next = windows.find((w) => w.from > t);
  return next ? { kind: next.kind, phase: 'next', start: next.start, end: next.end } : null;
}

/** `HH:MM` in the place's own clock. */
export function clockOf(iso: string): string {
  return iso.slice(11, 16);
}

/** "7 h 5 min", "23 min" or "1 min" from now until `iso`. */
export function untilText(iso: string, now: Date): string {
  const minutes = Math.max(1, Math.ceil((Date.parse(iso) - now.getTime()) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
