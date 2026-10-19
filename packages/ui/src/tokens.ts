// Design tokens for the three launch themes (spec 5.10). A theme is one token set: colours,
// radii and fonts. Golden light follows the locked mockups as inspiration only; every value is
// picked so that each text pair in TEXT_PAIRS meets WCAG AA (checked by the tests).

export const THEME_IDS = ['golden', 'golden_dark', 'camera'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  onDanger: string;
}

export interface ThemeTokens {
  colors: ThemeColors;
  radius: { sm: number; md: number; lg: number; pill: number };
  font: { body: string; display: string; mono: string };
  /** Settings blocks drawn as camera dials (Camera body only). */
  dialStyle: boolean;
}

const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
const font = { body: 'System', display: 'System', mono: 'monospace' };

export const THEME_TOKENS: Readonly<Record<ThemeId, ThemeTokens>> = {
  golden: {
    colors: {
      bg: '#fbf5ec',
      surface: '#ffffff',
      surfaceAlt: '#f3e6d3',
      text: '#2b1d12',
      textMuted: '#6b5442',
      primary: '#a8480b',
      onPrimary: '#ffffff',
      accent: '#1f4e5f',
      onAccent: '#ffffff',
      border: '#e3d2bc',
      success: '#2e6b31',
      warning: '#7a4f00',
      danger: '#a8231b',
      onDanger: '#ffffff',
    },
    radius,
    font,
    dialStyle: false,
  },
  golden_dark: {
    colors: {
      bg: '#17110b',
      surface: '#221a12',
      surfaceAlt: '#2e2318',
      text: '#f6ebdd',
      textMuted: '#c9b49c',
      primary: '#f2a65a',
      onPrimary: '#2b1606',
      accent: '#7cc4d6',
      onAccent: '#0e2a33',
      border: '#3d2f21',
      success: '#81c784',
      warning: '#f2c14e',
      danger: '#f28b82',
      onDanger: '#3b0a06',
    },
    radius,
    font,
    dialStyle: false,
  },
  camera: {
    colors: {
      bg: '#0f1012',
      surface: '#1a1c1f',
      surfaceAlt: '#25282c',
      text: '#ecedee',
      textMuted: '#a8adb3',
      primary: '#e8b04a',
      onPrimary: '#1a1305',
      accent: '#ff8a65',
      onAccent: '#1a0805',
      border: '#33373c',
      success: '#7bd389',
      warning: '#f5c451',
      danger: '#ff7a70',
      onDanger: '#2a0603',
    },
    radius: { sm: 4, md: 8, lg: 14, pill: 999 },
    font,
    dialStyle: true,
  },
};

/** Every text-on-background pair the app draws. Each must meet 4.5:1 in every theme. */
export const TEXT_PAIRS: ReadonlyArray<readonly [keyof ThemeColors, keyof ThemeColors]> = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surfaceAlt'],
  ['textMuted', 'bg'],
  ['textMuted', 'surface'],
  ['onPrimary', 'primary'],
  ['onAccent', 'accent'],
  ['onDanger', 'danger'],
  ['primary', 'surface'],
  ['success', 'surface'],
  ['warning', 'surface'],
  ['danger', 'surface'],
];

/** The theme to draw: Auto follows the phone between Golden light and Golden dark. */
export function resolveTheme(setting: ThemeId | 'auto', system: 'light' | 'dark'): ThemeId {
  if (setting === 'auto') return system === 'dark' ? 'golden_dark' : 'golden';
  return setting;
}
