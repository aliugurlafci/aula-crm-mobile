/**
 * SyncProvider / useSync — a thin adapter over the Redux `sync` slice. The
 * provider wires connectivity + app-lifecycle events to the sync thunks; the
 * durable outbox + catalogue engine underneath are unchanged. `useSync()` keeps
 * its original shape so callers (POS, Cart, Returns, Outbox screens) are
 * untouched, while online/syncing/counts state lives in the store.
 */
import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';

import { store, useAppDispatch, useAppSelector } from '@/lib/store';
import {
  refreshCounts as refreshCountsThunk,
  runSync,
  submitOutbox,
  retryFailed as retryFailedThunk,
  discardFailed as discardFailedThunk,
  setOnline,
  type SyncCounts,
} from '@/lib/store/syncSlice';
import * as outbox from '../db/outbox';
import type { OutboxKind, OutboxRow } from '../types';

export interface SyncValue {
  online: boolean;
  syncing: boolean;
  counts: SyncCounts;
  lastSyncAt: number | null;
  submit: (kind: OutboxKind, payload: unknown, idempotencyKey?: string) => Promise<OutboxRow>;
  sync: (reason?: string) => Promise<void>;
  refreshCounts: () => Promise<void>;
  retryFailed: (id: string) => Promise<void>;
  discardFailed: (id: string) => Promise<void>;
  listRecent: (limit?: number) => Promise<OutboxRow[]>;
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const authed = useAppSelector((s) => s.auth.status === 'authenticated');

  // Initial counts + connectivity probe.
  useEffect(() => {
    void dispatch(refreshCountsThunk());
    Network.getNetworkStateAsync()
      .then((s) => dispatch(setOnline(Boolean(s.isConnected))))
      .catch(() => dispatch(setOnline(true)));
  }, [dispatch]);

  // Connectivity changes — sync when we regain the network.
  useEffect(() => {
    const sub = Network.addNetworkStateListener((state) => {
      const next = Boolean(state.isConnected);
      const wasOnline = store.getState().sync.online;
      dispatch(setOnline(next));
      if (next && !wasOnline) void dispatch(runSync());
    });
    return () => sub.remove();
  }, [dispatch]);

  // Foreground — refresh + sync.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void dispatch(refreshCountsThunk());
        void dispatch(runSync());
      }
    });
    return () => sub.remove();
  }, [dispatch]);

  // Run an initial sync once authenticated (pull catalogue, flush any queue).
  useEffect(() => {
    if (authed) void dispatch(runSync());
    else void dispatch(refreshCountsThunk());
  }, [authed, dispatch]);

  return <>{children}</>;
}

export function useSync(): SyncValue {
  const dispatch = useAppDispatch();
  const { online, syncing, counts, lastSyncAt } = useAppSelector((s) => s.sync);

  return useMemo<SyncValue>(
    () => ({
      online,
      syncing,
      counts,
      lastSyncAt,
      submit: (kind, payload, idempotencyKey) => dispatch(submitOutbox({ kind, payload, idempotencyKey })).unwrap(),
      sync: () => dispatch(runSync()).unwrap(),
      refreshCounts: () => dispatch(refreshCountsThunk()).unwrap(),
      retryFailed: (id) => dispatch(retryFailedThunk(id)).unwrap(),
      discardFailed: (id) => dispatch(discardFailedThunk(id)).unwrap(),
      listRecent: (limit) => outbox.recent(limit),
    }),
    [online, syncing, counts, lastSyncAt, dispatch],
  );
}
