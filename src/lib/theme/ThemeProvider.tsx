/**
 * Theme — resolves the active glassmorphism palette from the OS color scheme plus
 * the user's override ('system' | 'light' | 'dark'). The override now lives in the
 * Redux `settings` slice (persisted via redux-persist and best-effort mirrored to
 * the server), so it's truly app-wide and survives relaunches. `useTheme()` keeps
 * its original shape; `ThemeProvider` is a pass-through kept for tree stability.
 */
import { useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useAppDispatch, useAppSelector } from '@/lib/store';
import { setThemeMode, syncPreferencesToServer, type ThemeMode } from '@/lib/store/settingsSlice';
import { DarkPalette, LightPalette, type Palette } from './tokens';

export type { ThemeMode };
type Scheme = 'light' | 'dark';

type ThemeValue = {
  palette: Palette;
  scheme: Scheme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useTheme(): ThemeValue {
  const system = useColorScheme();
  const dispatch = useAppDispatch();
  const mode = useAppSelector((s) => s.settings.themeMode);

  const setMode = useCallback(
    (next: ThemeMode) => {
      dispatch(setThemeMode(next));
      void dispatch(syncPreferencesToServer());
    },
    [dispatch],
  );

  const scheme: Scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;

  return useMemo<ThemeValue>(
    () => ({
      palette: scheme === 'dark' ? DarkPalette : LightPalette,
      scheme,
      mode,
      setMode,
      isDark: scheme === 'dark',
    }),
    [scheme, mode, setMode],
  );
}
