/**
 * SyncProvider — wires the sync engine to connectivity + app lifecycle and
 * exposes offline state to the UI.
 *
 *  - listens to expo-network: when the device comes back online, it drains the
 *    outbox and refreshes the catalogue.
 *  - listens to AppState: a sync runs when the app returns to the foreground.
 *  - `submit()` is the single write path for sales mutations: it enqueues to the
 *    durable outbox (so the action survives offline / a crash) and kicks a sync.
 *
 * Syncing only runs while authenticated, so queued sales are never hard-rejected
 * by a 401 after logout.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';

import { useAuth } from '../auth/AuthProvider';
import * as outbox from '../db/outbox';
import { pullCatalog, pushOutbox } from './engine';
import type { OutboxKind, OutboxRow } from '../types';

interface SyncCounts {
  pending: number;
  failed: number;
  done: number;
}

interface SyncValue {
  online: boolean;
  syncing: boolean;
  counts: SyncCounts;
  lastSyncAt: number | null;
  /** Enqueue a sale mutation durably + trigger a sync. Returns the queued row. */
  submit: (kind: OutboxKind, payload: unknown, idempotencyKey?: string) => Promise<OutboxRow>;
  sync: (reason?: string) => Promise<void>;
  refreshCounts: () => Promise<void>;
  retryFailed: (id: string) => Promise<void>;
  discardFailed: (id: string) => Promise<void>;
  listRecent: (limit?: number) => Promise<OutboxRow[]>;
}

const SyncContext = createContext<SyncValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const authed = status === 'authenticated';
  const authedRef = useRef(authed);
  authedRef.current = authed;

  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [counts, setCounts] = useState<SyncCounts>({ pending: 0, failed: 0, done: 0 });
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const runningRef = useRef(false);

  const refreshCounts = useCallback(async () => {
    try {
      setCounts(await outbox.counts());
    } catch {
      /* db may not be ready yet */
    }
  }, []);

  const sync = useCallback(
    async (_reason?: string) => {
      if (runningRef.current || !authedRef.current) return;
      runningRef.current = true;
      setSyncing(true);
      try {
        const push = await pushOutbox();
        await refreshCounts();
        // Only pull fresh catalogue when the outbox drained cleanly (i.e. online).
        if (!push.blocked) {
          try {
            await pullCatalog();
          } catch {
            /* offline / permission — keep last cache */
          }
        }
        setLastSyncAt(Date.now());
      } finally {
        runningRef.current = false;
        setSyncing(false);
      }
    },
    [refreshCounts],
  );

  const submit = useCallback(
    async (kind: OutboxKind, payload: unknown, idempotencyKey?: string) => {
      const row = await outbox.enqueue(kind, payload, idempotencyKey);
      await refreshCounts();
      // Fire-and-forget; UI already has its optimistic result.
      void sync('submit');
      return row;
    },
    [refreshCounts, sync],
  );

  const retryFailed = useCallback(
    async (id: string) => {
      await outbox.retry(id);
      await refreshCounts();
      void sync('retry');
    },
    [refreshCounts, sync],
  );

  const discardFailed = useCallback(
    async (id: string) => {
      await outbox.discard(id);
      await refreshCounts();
    },
    [refreshCounts],
  );

  const listRecent = useCallback((limit?: number) => outbox.recent(limit), []);

  // Initial counts + connectivity probe.
  useEffect(() => {
    void refreshCounts();
    Network.getNetworkStateAsync()
      .then((s) => setOnline(Boolean(s.isConnected)))
      .catch(() => setOnline(true));
  }, [refreshCounts]);

  // Connectivity changes — sync when we regain the network.
  useEffect(() => {
    const sub = Network.addNetworkStateListener((state) => {
      const next = Boolean(state.isConnected);
      setOnline((prev) => {
        if (next && !prev) void sync('online');
        return next;
      });
    });
    return () => sub.remove();
  }, [sync]);

  // Foreground — refresh + sync.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshCounts();
        void sync('foreground');
      }
    });
    return () => sub.remove();
  }, [refreshCounts, sync]);

  // Run an initial sync once authenticated (pull catalogue, flush any queue).
  useEffect(() => {
    if (authed) void sync('authenticated');
    else void refreshCounts();
  }, [authed, sync, refreshCounts]);

  const value = useMemo<SyncValue>(
    () => ({ online, syncing, counts, lastSyncAt, submit, sync, refreshCounts, retryFailed, discardFailed, listRecent }),
    [online, syncing, counts, lastSyncAt, submit, sync, refreshCounts, retryFailed, discardFailed, listRecent],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
