import { THEMES } from '@fotoai/contracts';
import { describe, expect, test } from 'vitest';

import { contrastRatio, resolveTheme, TEXT_PAIRS, THEME_IDS, THEME_TOKENS, themeVars, type ThemeColors } from '../src/index.ts';

const COLOR_KEYS: Array<keyof ThemeColors> = [
  'bg', 'surface', 'surfaceAlt', 'text', 'textMuted', 'primary', 'onPrimary', 'accent', 'onAccent',
  'border', 'success', 'warning', 'danger', 'onDanger',
];

describe('theme tokens', () => {
  test('the theme ids match THEMES from contracts', () => {
    // 'auto' joins THEMES in 3B; it is a setting, not a token set.
    expect([...THEME_IDS].sort()).toEqual(([...THEMES] as string[]).filter((t) => t !== 'auto').sort());
  });

  test('every theme has every token', () => {
    for (const id of THEME_IDS) {
      const t = THEME_TOKENS[id];
      for (const key of COLOR_KEYS) expect(t.colors[key], `${id}.${key}`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Object.keys(t.radius).sort()).toEqual(['lg', 'md', 'pill', 'sm']);
      expect(Object.keys(t.font).sort()).toEqual(['body', 'display', 'mono']);
    }
  });

  test('every text pair meets WCAG AA (4.5:1) in every theme', () => {
    for (const id of THEME_IDS) {
      for (const [fg, bg] of TEXT_PAIRS) {
        const ratio = contrastRatio(THEME_TOKENS[id].colors[fg], THEME_TOKENS[id].colors[bg]);
        expect(ratio, `${id}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('the contrast math matches WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    // The audit's white on orange: about 2.8:1, so it must fail AA.
    expect(contrastRatio('#ffffff', '#f97316')).toBeLessThan(3);
  });

  test('auto follows the system between golden and golden_dark', () => {
    expect(resolveTheme('auto', 'light')).toBe('golden');
    expect(resolveTheme('auto', 'dark')).toBe('golden_dark');
    expect(resolveTheme('camera', 'light')).toBe('camera');
    expect(resolveTheme('golden', 'dark')).toBe('golden');
  });

  test('only the camera theme uses the dial style', () => {
    expect(THEME_IDS.filter((id) => THEME_TOKENS[id].dialStyle)).toEqual(['camera']);
  });

  test('themeVars gives one CSS variable per colour as space-separated RGB', () => {
    const vars = themeVars('golden');
    expect(Object.keys(vars)).toHaveLength(COLOR_KEYS.length);
    expect(vars['--color-text']).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
  });
});
