/**
 * Mobile screen-config slice — which screens the app may show this user, curated
 * by an admin on the web (`/settings/mobile`) and enforced here as a navigation
 * gate. Seeded from `/auth/me` (`mobileScreens`) on login and refreshed by
 * polling `/mobile/config` on foreground + on an interval, so admin changes take
 * effect without a re-login. `screens: null` means "not yet loaded" — the gate
 * treats that as allow-all so the app is never blank while the first fetch runs.
 */
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { mobile } from '@/lib/api/endpoints';
import type { Me, MobileConfig } from '@/lib/types';

export interface ConfigState {
  screens: string[] | null;
  version: string | null;
  hiddenFields: Record<string, string[]>;
  lastCheckedAt: number | null;
}

const initialState: ConfigState = {
  screens: null,
  version: null,
  hiddenFields: {},
  lastCheckedAt: null,
};

/** Poll the live resolved config; picks up admin changes between logins. */
export const refreshMobileConfig = createAsyncThunk('config/refresh', async () => {
  return mobile.config();
});

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    /** Seed from the /auth/me payload (login + background refresh). */
    setFromMe(state, action: PayloadAction<Me>) {
      const me = action.payload;
      state.screens = me.mobileScreens ?? null;
      state.version = me.mobileScreensVersion ?? null;
      state.hiddenFields = me.mobileHiddenFields ?? {};
    },
    setConfig(state, action: PayloadAction<MobileConfig>) {
      state.screens = action.payload.screens;
      state.version = action.payload.version;
      state.hiddenFields = action.payload.hiddenFields ?? {};
      state.lastCheckedAt = Date.now();
    },
    resetConfig() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(refreshMobileConfig.fulfilled, (state, action) => {
      state.screens = action.payload.screens;
      state.version = action.payload.version;
      state.hiddenFields = action.payload.hiddenFields ?? {};
      state.lastCheckedAt = Date.now();
    });
  },
});

export const { setFromMe, setConfig, resetConfig } = configSlice.actions;
export default configSlice.reducer;
