/**
 * Theme context — resolves the active glassmorphism palette from the OS color
 * scheme plus an optional user override ('system' | 'light' | 'dark'), persisted
 * in SecureStore so the choice survives relaunches (mirrors the web appearance
 * setting). Exposes `useTheme()` for every component.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { DarkPalette, LightPalette, type Palette } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';
type Scheme = 'light' | 'dark';

const STORE_KEY = 'aula.theme.mode';

type ThemeValue = {
  palette: Palette;
  scheme: Scheme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(STORE_KEY)
      .then((stored) => {
        if (alive && (stored === 'light' || stored === 'dark' || stored === 'system')) {
          setModeState(stored);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    SecureStore.setItemAsync(STORE_KEY, next).catch(() => {});
  }, []);

  const scheme: Scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo<ThemeValue>(
    () => ({
      palette: scheme === 'dark' ? DarkPalette : LightPalette,
      scheme,
      mode,
      setMode,
      isDark: scheme === 'dark',
    }),
    [scheme, mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
