/**
 * Auth slice — the session lifecycle, ported from the old AuthProvider so the
 * store owns status/profile while the proven token+cache plumbing (SecureStore
 * token, SQLite `me` cache) is reused unchanged. Every profile update also feeds
 * the config slice (mobileScreens travel on `/auth/me`) and the settings slice
 * (server-synced prefs). `useAuth()` reads this slice and keeps its old shape.
 */
import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
  type ThunkDispatch,
  type UnknownAction,
} from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';

import { ApiRequestError, loadBaseUrl, setAuthToken, setCsrfToken, takeCapturedSessionToken } from '@/lib/api/client';
import { auth } from '@/lib/api/endpoints';
import { kvGet, kvSet } from '@/lib/db/database';
import type { Me } from '@/lib/types';
import { setFromMe, resetConfig } from './configSlice';
import { setServerSettings } from './settingsSlice';

const TOKEN_KEY = 'aula.auth.token';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

export interface LoginResult {
  ok: boolean;
  twoFactorRequired?: boolean;
  error?: string;
}

export interface AuthState {
  status: AuthStatus;
  me: Me | null;
  offline: boolean;
}

const initialState: AuthState = { status: 'loading', me: null, offline: false };

type Dispatch = ThunkDispatch<unknown, unknown, UnknownAction>;

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<{ me: Me; offline: boolean }>) {
      state.me = action.payload.me;
      state.status = 'authenticated';
      state.offline = action.payload.offline;
    },
    setUnauthenticated(state) {
      state.me = null;
      state.status = 'unauthenticated';
      state.offline = false;
    },
    setOffline(state, action: PayloadAction<boolean>) {
      state.offline = action.payload;
    },
  },
});

const { setSession, setUnauthenticated } = authSlice.actions;

/** Fan a fresh profile out to the slices that derive from it (config screens +
 *  server-synced settings), keeping them in lock-step with the session. */
function applyProfile(dispatch: Dispatch, profile: Me): void {
  dispatch(setFromMe(profile));
  dispatch(setServerSettings(profile.settings ?? {}));
}

/** Persist the session token + profile, then land the store in `authenticated`. */
async function persistSession(dispatch: Dispatch, token: string, profile: Me): Promise<void> {
  setAuthToken(token);
  await SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => {});
  await kvSet('me', profile);
  applyProfile(dispatch, profile);
  dispatch(setSession({ me: profile, offline: false }));
}

/** Shared tail of both login paths: load the profile, persist, surface a result. */
async function finishLogin(dispatch: Dispatch, token: string | null): Promise<LoginResult> {
  if (token) setAuthToken(token);
  try {
    const profile = await auth.me();
    await persistSession(dispatch, token ?? (await SecureStore.getItemAsync(TOKEN_KEY)) ?? '', profile);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof ApiRequestError ? err.message : 'Could not load profile' };
  }
}

/** Restore the session on launch: token → cached profile (instant) → refresh. */
export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async (_arg, { dispatch }) => {
  await loadBaseUrl();
  const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
  if (!token) {
    dispatch(setUnauthenticated());
    return;
  }
  setAuthToken(token);
  const cached = await kvGet<Me>('me');
  if (cached) {
    applyProfile(dispatch, cached);
    dispatch(setSession({ me: cached, offline: true })); // show cached UI at once
  }
  try {
    const fresh = await auth.me();
    await kvSet('me', fresh);
    applyProfile(dispatch, fresh);
    dispatch(setSession({ me: fresh, offline: false }));
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      setAuthToken(null);
      dispatch(setUnauthenticated());
    } else if (!cached) {
      dispatch(setUnauthenticated()); // no cache + unreachable → logged out
    }
    // else: keep the cached profile (offline).
  }
});

export const loginWithCredentials = createAsyncThunk<LoginResult, { email: string; password: string; code?: string }>(
  'auth/loginCredentials',
  async ({ email, password, code }, { dispatch }) => {
    try {
      const res = await auth.login(email, password, code);
      if (res.twoFactorRequired) return { ok: false, twoFactorRequired: true };
      const token = res.token ?? takeCapturedSessionToken();
      return finishLogin(dispatch, token ?? null);
    } catch (err) {
      return { ok: false, error: err instanceof ApiRequestError ? err.message : 'Login failed' };
    }
  },
);

export const loginPersona = createAsyncThunk<LoginResult, string>('auth/loginPersona', async (actor, { dispatch }) => {
  try {
    const res = await auth.loginPersona(actor);
    const token = res.token ?? takeCapturedSessionToken();
    return finishLogin(dispatch, token ?? null);
  } catch (err) {
    return { ok: false, error: err instanceof ApiRequestError ? err.message : 'Login failed' };
  }
});

export const refreshMe = createAsyncThunk('auth/refreshMe', async (_arg, { dispatch }) => {
  try {
    const fresh = await auth.me();
    await kvSet('me', fresh);
    applyProfile(dispatch, fresh);
    dispatch(setSession({ me: fresh, offline: false }));
  } catch {
    /* keep current */
  }
});

export const logout = createAsyncThunk('auth/logout', async (_arg, { dispatch }) => {
  try {
    await auth.logout();
  } catch {
    /* best effort */
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  setAuthToken(null);
  setCsrfToken(null);
  await kvSet('me', null);
  dispatch(resetConfig());
  dispatch(setUnauthenticated());
});

export const { setOffline } = authSlice.actions;
export default authSlice.reducer;
