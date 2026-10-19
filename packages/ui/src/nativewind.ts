// Tokens as CSS variables for NativeWind (mobile) and CSS (web, phase 4). Colours are
// space-separated RGB so Tailwind's opacity modifiers work: rgb(var(--color-text) / 0.6).

import { hexToRgb } from './contrast.ts';
import { THEME_TOKENS, type ThemeColors, type ThemeId } from './tokens.ts';

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function themeVars(theme: ThemeId): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, hex] of Object.entries(THEME_TOKENS[theme].colors)) vars[`--color-${kebab(key)}`] = hexToRgb(hex).join(' ');
  return vars;
}

/** The Tailwind `theme.extend.colors` entries that read those variables. */
export function tailwindColors(): Record<keyof ThemeColors, string> {
  const keys = Object.keys(THEME_TOKENS.golden.colors) as Array<keyof ThemeColors>;
  return Object.fromEntries(keys.map((k) => [k, `rgb(var(--color-${kebab(k)}) / <alpha-value>)`])) as Record<keyof ThemeColors, string>;
}
