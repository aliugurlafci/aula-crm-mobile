/**
 * App-wide settings slice — the single source of truth for theme, language,
 * backend URL and the server-synced per-user settings. Theme/language are
 * persisted locally (redux-persist, so the choice survives relaunch) and
 * best-effort mirrored to the server (`/auth/settings`) so the same preferences
 * follow the user across the web app and other devices. The backend URL stays
 * owned by the API client (SecureStore); this slice mirrors it for the UI.
 */
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';
import { getBaseUrl, loadBaseUrl, setBaseUrl } from '@/lib/api/client';
import { auth } from '@/lib/api/endpoints';
import { LANGUAGES, type Lang } from '@/lib/i18n/translations';

const LEGACY_THEME_KEY = 'aula.theme.mode';
const LEGACY_LANG_KEY = 'aula.language';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface SettingsState {
  themeMode: ThemeMode;
  language: Lang;
  backendBaseUrl: string;
  /** Server-synced per-user settings (theme/accent/density/mailSyncInterval…). */
  serverSettings: Record<string, string>;
}

const initialState: SettingsState = {
  themeMode: 'system',
  language: 'en',
  backendBaseUrl: '',
  serverSettings: {},
};

/** Read the API client's effective base URL into the slice (client is authority). */
export const initBackendBaseUrl = createAsyncThunk('settings/initBackendBaseUrl', async () => {
  const url = await loadBaseUrl().catch(() => getBaseUrl());
  return url;
});

/** Change the backend URL: update the API client (persists) + mirror into state. */
export const changeBackendBaseUrl = createAsyncThunk('settings/changeBackendBaseUrl', async (url: string) => {
  await setBaseUrl(url);
  return getBaseUrl();
});

/** Best-effort push of the local preferences to the server (ignored when offline
 *  or signed out — the local values remain authoritative). */
export const syncPreferencesToServer = createAsyncThunk<void, void, { state: { settings: SettingsState } }>(
  'settings/syncPreferencesToServer',
  async (_arg, { getState }) => {
    const { themeMode, language } = getState().settings;
    try {
      await auth.updateSettings({ theme: themeMode, language });
    } catch {
      /* offline / unauthenticated — keep local */
    }
  },
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload;
    },
    setLanguage(state, action: PayloadAction<Lang>) {
      state.language = action.payload;
    },
    setServerSettings(state, action: PayloadAction<Record<string, string>>) {
      state.serverSettings = action.payload ?? {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initBackendBaseUrl.fulfilled, (state, action) => {
        state.backendBaseUrl = action.payload;
      })
      .addCase(changeBackendBaseUrl.fulfilled, (state, action) => {
        state.backendBaseUrl = action.payload;
      });
  },
});

export const { setThemeMode, setLanguage, setServerSettings } = settingsSlice.actions;

/** One-time carry-over of the theme/language a user picked before the Redux
 *  migration (stored in SecureStore). Runs after rehydration; deletes the legacy
 *  keys so it only takes effect once, then redux-persist owns the values. */
export const migrateLegacySettings = createAsyncThunk('settings/migrateLegacy', async (_arg, { dispatch }) => {
  const theme = await SecureStore.getItemAsync(LEGACY_THEME_KEY).catch(() => null);
  if (theme === 'light' || theme === 'dark' || theme === 'system') {
    dispatch(setThemeMode(theme));
    await SecureStore.deleteItemAsync(LEGACY_THEME_KEY).catch(() => {});
  }
  const lang = await SecureStore.getItemAsync(LEGACY_LANG_KEY).catch(() => null);
  if (lang && (LANGUAGES as readonly string[]).includes(lang)) {
    dispatch(setLanguage(lang as Lang));
    await SecureStore.deleteItemAsync(LEGACY_LANG_KEY).catch(() => {});
  }
});

export default settingsSlice.reducer;
