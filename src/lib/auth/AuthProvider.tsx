/**
 * AuthProvider — owns the session lifecycle for the mobile app.
 *
 * Login paths (both yield a bearer token the backend accepts on every request):
 *   - persona/demo: POST /auth/login {actor} returns the JWT in the body.
 *   - credentials:  POST /auth/login {email,password,code?} sets the aula_session
 *     cookie; RN exposes Set-Cookie so we recover the JWT from it. If that fails
 *     (rare, iOS), the native cookie jar still carries the session for /auth/me.
 *
 * The token is persisted in SecureStore (Keychain / EncryptedSharedPreferences)
 * and the profile cached in SQLite, so the app reopens straight into the session
 * — and stays usable offline using the cached grants/screens.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  loadBaseUrl,
  setAuthToken,
  setCsrfToken,
  takeCapturedSessionToken,
} from '../api/client';
import { auth } from '../api/endpoints';
import { ApiRequestError } from '../api/client';
import { kvGet, kvSet } from '../db/database';
import * as SecureStore from 'expo-secure-store';
import { can, canEntity, grantsForRoles, hasScreen } from './permissions';
import type { Me } from '../types';

const TOKEN_KEY = 'aula.auth.token';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

export interface LoginResult {
  ok: boolean;
  twoFactorRequired?: boolean;
  error?: string;
}

interface AuthValue {
  status: AuthStatus;
  me: Me | null;
  grants: string[];
  /** True when running on a cached profile without a fresh /auth/me this launch. */
  offline: boolean;
  loginWithCredentials: (email: string, password: string, code?: string) => Promise<LoginResult>;
  loginPersona: (actor: string) => Promise<LoginResult>;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
  // permission helpers bound to the current session
  can: (action: string) => boolean;
  canEntity: (entity: string, verb: string) => boolean;
  hasScreen: (key: string) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

function effectiveGrants(me: Me | null): string[] {
  if (!me) return [];
  if (me.grants?.length) return me.grants;
  return grantsForRoles(me.roles ?? []);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [offline, setOffline] = useState(false);

  const persistSession = useCallback(async (token: string, profile: Me) => {
    setAuthToken(token);
    await SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => {});
    await kvSet('me', profile);
    setMe(profile);
    setStatus('authenticated');
    setOffline(false);
  }, []);

  // Hydrate on launch: restore token, show cached profile immediately, refresh.
  useEffect(() => {
    let alive = true;
    (async () => {
      await loadBaseUrl();
      const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
      if (!token) {
        if (alive) setStatus('unauthenticated');
        return;
      }
      setAuthToken(token);
      const cached = await kvGet<Me>('me');
      if (cached && alive) {
        setMe(cached);
        setStatus('authenticated');
        setOffline(true);
      }
      // Refresh in the background; downgrade only on a real auth rejection.
      try {
        const fresh = await auth.me();
        if (!alive) return;
        await kvSet('me', fresh);
        setMe(fresh);
        setStatus('authenticated');
        setOffline(false);
      } catch (err) {
        if (!alive) return;
        if (err instanceof ApiRequestError && err.status === 401) {
          await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
          setAuthToken(null);
          setMe(null);
          setStatus('unauthenticated');
        } else if (!cached) {
          // No cached profile and we can't reach the server — treat as logged out.
          setStatus('unauthenticated');
        }
        // else: keep the cached profile (offline).
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const finishLogin = useCallback(
    async (token: string | null): Promise<LoginResult> => {
      // `token` may be null on the credential path if Set-Cookie wasn't exposed;
      // the native cookie jar still authenticates /auth/me.
      if (token) setAuthToken(token);
      try {
        const profile = await auth.me();
        await persistSession(token ?? (await SecureStore.getItemAsync(TOKEN_KEY)) ?? '', profile);
        return { ok: true };
      } catch (err) {
        const message = err instanceof ApiRequestError ? err.message : 'Could not load profile';
        return { ok: false, error: message };
      }
    },
    [persistSession],
  );

  const loginWithCredentials = useCallback(
    async (email: string, password: string, code?: string): Promise<LoginResult> => {
      try {
        const res = await auth.login(email, password, code);
        if (res.twoFactorRequired) return { ok: false, twoFactorRequired: true };
        const token = res.token ?? takeCapturedSessionToken();
        return finishLogin(token ?? null);
      } catch (err) {
        const message = err instanceof ApiRequestError ? err.message : 'Login failed';
        return { ok: false, error: message };
      }
    },
    [finishLogin],
  );

  const loginPersona = useCallback(
    async (actor: string): Promise<LoginResult> => {
      try {
        const res = await auth.loginPersona(actor);
        const token = res.token ?? takeCapturedSessionToken();
        return finishLogin(token ?? null);
      } catch (err) {
        const message = err instanceof ApiRequestError ? err.message : 'Login failed';
        return { ok: false, error: message };
      }
    },
    [finishLogin],
  );

  const refreshMe = useCallback(async () => {
    try {
      const fresh = await auth.me();
      await kvSet('me', fresh);
      setMe(fresh);
      setOffline(false);
    } catch {
      /* keep current */
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } catch {
      /* best effort */
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    setAuthToken(null);
    setCsrfToken(null);
    await kvSet('me', null);
    setMe(null);
    setStatus('unauthenticated');
    setOffline(false);
  }, []);

  const grants = useMemo(() => effectiveGrants(me), [me]);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      me,
      grants,
      offline,
      loginWithCredentials,
      loginPersona,
      refreshMe,
      logout,
      can: (action: string) => can(grants, action),
      canEntity: (entity: string, verb: string) => canEntity(grants, entity, verb),
      hasScreen: (key: string) => hasScreen(me?.screens, key),
    }),
    [status, me, grants, offline, loginWithCredentials, loginPersona, refreshMe, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
