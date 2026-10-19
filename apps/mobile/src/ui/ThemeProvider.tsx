// Applies the chosen theme: the @fotoai/ui tokens become NativeWind CSS variables on the root
// view, so `bg-surface`, `text-text` and friends follow the theme. Auto follows the phone.
// The choice is kept on the phone for now; 3C saves it to the account's preferences.

import { resolveTheme, THEME_TOKENS, themeVars, type ThemeId, type ThemeTokens } from '@fotoai/ui';
import Storage from 'expo-sqlite/kv-store';
import { vars } from 'nativewind';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';

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

export function ThemeProvider({ initial, children }: { initial?: ThemeSetting; children: ReactNode }) {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [setting, setLocal] = useState<ThemeSetting>(initial ?? 'auto');

  useEffect(() => {
    if (initial) return;
    Storage.getItem(KEY)
      .then((saved) => saved && SETTINGS.includes(saved as ThemeSetting) && setLocal(saved as ThemeSetting))
      .catch(() => undefined); // no saved choice: Auto
  }, [initial]);

  const theme = resolveTheme(setting, system);
  const value = useMemo<ThemeValue>(
    () => ({
      setting,
      setSetting: (s) => {
        setLocal(s);
        Storage.setItem(KEY, s).catch(() => undefined);
      },
      theme,
      tokens: THEME_TOKENS[theme],
    }),
    [setting, theme],
  );
  const style = useMemo(() => vars(themeVars(theme)), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      <View testID="theme-root" className="flex-1 bg-bg" style={style}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
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
