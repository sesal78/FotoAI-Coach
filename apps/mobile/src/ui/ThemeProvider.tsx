// Applies the chosen theme: the @fotoai/ui tokens become NativeWind CSS variables on the root
// view, so `bg-surface`, `text-text` and friends follow the theme. Auto follows the phone.
// The choice is kept on the phone and read before the first frame (no flicker); Settings saves it
// to the account, and ThemeSync applies the account's choice after sign-in.

import { resolveTheme, THEME_TOKENS, themeVars, type ThemeId, type ThemeTokens } from '@fotoai/ui';
import Storage from 'expo-sqlite/kv-store';
import { vars } from 'nativewind';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';

import { usePreferences } from '../data/hooks';

export type ThemeSetting = ThemeId | 'auto';
const SETTINGS: readonly ThemeSetting[] = ['auto', 'golden', 'golden_dark', 'camera'];
const KEY = 'fotoai.theme.v1';

interface ThemeValue {
  setting: ThemeSetting;
  setSetting: (s: ThemeSetting) => void;
  theme: ThemeId;
  tokens: ThemeTokens;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/** The choice saved on the phone, read synchronously so the first frame has the right colours. */
function savedSetting(): ThemeSetting | null {
  try {
    const saved = Storage.getItemSync(KEY);
    return saved && SETTINGS.includes(saved as ThemeSetting) ? (saved as ThemeSetting) : null;
  } catch {
    return null; // no saved choice: Auto
  }
}

export function ThemeProvider({ initial, children }: { initial?: ThemeSetting; children: ReactNode }) {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [setting, setLocal] = useState<ThemeSetting>(() => initial ?? savedSetting() ?? 'auto');

  // Stable, so ThemeSync's effect runs only when the account's choice changes.
  const setSetting = useCallback((s: ThemeSetting) => {
    setLocal(s);
    Storage.setItem(KEY, s).catch(() => undefined);
  }, []);

  const theme = resolveTheme(setting, system);
  const value = useMemo<ThemeValue>(() => ({ setting, setSetting, theme, tokens: THEME_TOKENS[theme] }), [setting, setSetting, theme]);
  const style = useMemo(() => vars(themeVars(theme)), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      <View testID="theme-root" className="flex-1 bg-bg" style={style}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

/** After sign-in, the account's theme wins over the phone's copy. Renders nothing. */
export function ThemeSync() {
  const account = usePreferences().data?.theme;
  const { setSetting } = useTheme();
  useEffect(() => {
    if (account) setSetting(account);
  }, [account, setSetting]);
  return null;
}

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be inside ThemeProvider');
  return value;
}

export const THEME_LABELS: Record<ThemeSetting, string> = {
  auto: 'Auto',
  golden: 'Golden light',
  golden_dark: 'Golden dark',
  camera: 'Camera body',
};
