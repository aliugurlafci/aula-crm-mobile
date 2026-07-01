/**
 * Mobile screen-access gate. The admin curates which screens appear on mobile
 * (web `/settings/mobile`); the backend resolves that against the user's own
 * permissions and returns the effective set via `/auth/me` + `/mobile/config`.
 * Here we read that set from the `config` slice and gate navigation:
 *   - `useScreenAccess().isAllowed(key)` — is a screen visible for this user?
 *   - `useConfigPolling()` — keep the set fresh (auth + foreground + 60s poll).
 *   - `<ScreenGate>` — a route-level guard for standalone screens.
 * `screens === null` means "not loaded yet" → allow-all, so the app is never
 * blank while the first fetch runs. A few utility screens are always reachable.
 */
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppDispatch, useAppSelector } from '@/lib/store';
import { refreshMobileConfig } from '@/lib/store/configSlice';
import { useI18n } from '@/lib/i18n/LanguageProvider';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/ui';

/** Screens always reachable regardless of admin config (safety / recovery). */
const ALWAYS_ALLOWED = new Set(['settings', 'outbox', 'scanner', 'more', 'home']);

export function useScreenAccess() {
  const dispatch = useAppDispatch();
  const screens = useAppSelector((s) => s.config.screens);
  const version = useAppSelector((s) => s.config.version);
  const isAllowed = useCallback(
    (key: string) => ALWAYS_ALLOWED.has(key) || screens === null || screens.includes(key),
    [screens],
  );
  const refresh = useCallback(() => dispatch(refreshMobileConfig()), [dispatch]);
  return { screens, version, isAllowed, refresh };
}

/** Keep the resolved mobile config fresh so admin changes land without re-login. */
export function useConfigPolling(): void {
  const dispatch = useAppDispatch();
  const authed = useAppSelector((s) => s.auth.status === 'authenticated');
  useEffect(() => {
    if (!authed) return;
    void dispatch(refreshMobileConfig());
    const id = setInterval(() => void dispatch(refreshMobileConfig()), 60_000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void dispatch(refreshMobileConfig());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [authed, dispatch]);
}

/** Route-level guard for standalone screens (pairs with tab-bar hiding). */
export function ScreenGate({ screen, title, children }: { screen: string; title?: string; children: React.ReactNode }) {
  const { isAllowed } = useScreenAccess();
  const { t } = useI18n();
  if (isAllowed(screen)) return <>{children}</>;
  return (
    <Screen title={title ?? t('gate.unavailableTitle')} back>
      <EmptyState icon="lock-closed-outline" title={t('gate.unavailableTitle')} hint={t('gate.unavailableHint')} />
    </Screen>
  );
}
