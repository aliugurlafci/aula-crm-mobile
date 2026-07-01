/**
 * AuthProvider / useAuth — now a thin adapter over the Redux `auth` slice. The
 * provider just kicks off session bootstrap (and reconciles the backend URL);
 * `useAuth()` keeps its original shape so every screen is untouched, while the
 * session state, login flows and profile cache live in the store (see
 * `@/lib/store/authSlice`). Permission helpers stay pure functions bound here.
 */
import { useEffect, useMemo } from 'react';

import { useAppDispatch, useAppSelector } from '@/lib/store';
import {
  bootstrapAuth,
  loginWithCredentials as loginCredentialsThunk,
  loginPersona as loginPersonaThunk,
  refreshMe as refreshMeThunk,
  logout as logoutThunk,
} from '@/lib/store/authSlice';
import { initBackendBaseUrl } from '@/lib/store/settingsSlice';
import { can, canEntity, grantsForRoles, hasScreen } from './permissions';
import type { Me } from '../types';

export type { AuthStatus, LoginResult } from '@/lib/store/authSlice';
import type { AuthStatus, LoginResult } from '@/lib/store/authSlice';

export interface AuthValue {
  status: AuthStatus;
  me: Me | null;
  grants: string[];
  /** True when running on a cached profile without a fresh /auth/me this launch. */
  offline: boolean;
  loginWithCredentials: (email: string, password: string, code?: string) => Promise<LoginResult>;
  loginPersona: (actor: string) => Promise<LoginResult>;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
  can: (action: string) => boolean;
  canEntity: (entity: string, verb: string) => boolean;
  hasScreen: (key: string) => boolean;
}

function effectiveGrants(me: Me | null): string[] {
  if (!me) return [];
  if (me.grants?.length) return me.grants;
  return grantsForRoles(me.roles ?? []);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    void dispatch(initBackendBaseUrl());
    void dispatch(bootstrapAuth());
  }, [dispatch]);
  return <>{children}</>;
}

export function useAuth(): AuthValue {
  const dispatch = useAppDispatch();
  const { status, me, offline } = useAppSelector((s) => s.auth);
  const grants = useMemo(() => effectiveGrants(me), [me]);

  return useMemo<AuthValue>(
    () => ({
      status,
      me,
      grants,
      offline,
      loginWithCredentials: (email, password, code) => dispatch(loginCredentialsThunk({ email, password, code })).unwrap(),
      loginPersona: (actor) => dispatch(loginPersonaThunk(actor)).unwrap(),
      refreshMe: () => dispatch(refreshMeThunk()).unwrap(),
      logout: () => dispatch(logoutThunk()).unwrap(),
      can: (action) => can(grants, action),
      canEntity: (entity, verb) => canEntity(grants, entity, verb),
      hasScreen: (key) => hasScreen(me?.screens, key),
    }),
    [status, me, grants, offline, dispatch],
  );
}
