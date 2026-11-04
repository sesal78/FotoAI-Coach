// Which moving picture the weather card shows: from the weather kind, the wind and the time of day.
// Pure, so the choice is tested without drawing anything.

import type { Condition } from '@fotoai/contracts';

export type SceneKind = 'clear' | 'partly_cloudy' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunder';

/** Wind lines are added from this speed (a "strong breeze"). */
export const WINDY_KPH = 30;

export interface Scene {
  kind: SceneKind;
  night: boolean;
  windy: boolean;
  /** Sky colours, top to bottom. */
  sky: readonly [string, string];
}

const DAY: Record<SceneKind, readonly [string, string]> = {
  clear: ['#ffcf86', '#fdebd0'],
  partly_cloudy: ['#ffdca3', '#f3eee6'],
  cloudy: ['#bfc7cf', '#e7eaed'],
  fog: ['#cfc9bf', '#ece7df'],
  drizzle: ['#a9b6c2', '#dde3e8'],
  rain: ['#8e9cab', '#cdd5dc'],
  snow: ['#d8e3ec', '#f6f9fb'],
  thunder: ['#3f4856', '#7d8796'],
};

const NIGHT: Record<SceneKind, readonly [string, string]> = {
  clear: ['#18223f', '#3a4970'],
  partly_cloudy: ['#1d2744', '#45506f'],
  cloudy: ['#2a313d', '#4c5563'],
  fog: ['#3a3d44', '#5d6168'],
  drizzle: ['#28313e', '#4b5665'],
  rain: ['#222a36', '#435063'],
  snow: ['#2f3a4c', '#5a6a80'],
  thunder: ['#1b2029', '#3c4452'],
};

/** The picture for the weather now, or null when the weather kind is unknown. */
export function sceneOf(condition: Condition, windKph: number, night: boolean): Scene | null {
  if (condition === 'unknown') return null;
  return { kind: condition, night, windy: windKph >= WINDY_KPH, sky: (night ? NIGHT : DAY)[condition] };
}
