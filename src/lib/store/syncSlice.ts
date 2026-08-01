/**
 * Sync slice — mirrors the offline sync engine's state into the store and drives
 * it via thunks. The durable outbox + SQLite catalogue (the offline core) are
 * unchanged; this only owns the online/syncing/counts UI state and the single
 * `submit` write path. A module-level guard keeps concurrent syncs from
 * overlapping (as the old provider's ref did). `useSync()` keeps its old shape.
 */
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { kvSet, resetDatabase } from '@/lib/db/database';
import * as outbox from '@/lib/db/outbox';
import { pullCatalog, pushOutbox } from '@/lib/sync/engine';
import type { Me, OutboxKind, OutboxRow } from '@/lib/types';
import { refreshMe } from './authSlice';
import { refreshMobileConfig } from './configSlice';

export interface SyncCounts {
  pending: number;
  failed: number;
  done: number;
}
export interface SyncState {
  online: boolean;
  syncing: boolean;
  counts: SyncCounts;
  lastSyncAt: number | null;
}

const initialState: SyncState = {
  online: true,
  syncing: false,
  counts: { pending: 0, failed: 0, done: 0 },
  lastSyncAt: null,
};

// Prevents overlapping syncs across triggers (network regain, foreground, submit).
let running = false;

export const refreshCounts = createAsyncThunk('sync/refreshCounts', async (_arg, { dispatch }) => {
  try {
    dispatch(setCounts(await outbox.counts()));
  } catch {
    /* db may not be ready yet */
  }
});

export const runSync = createAsyncThunk('sync/run', async (_arg, { dispatch, getState }) => {
  const state = getState() as { auth: { status: string } };
  if (running || state.auth.status !== 'authenticated') return;
  running = true;
  dispatch(setSyncing(true));
  try {
    const push = await pushOutbox();
    dispatch(setCounts(await outbox.counts()));
    if (!push.blocked) {
      try {
        await pullCatalog();
      } catch {
        /* offline / permission — keep last cache */
      }
    }
    dispatch(setLastSyncAt(Date.now()));
  } finally {
    running = false;
    dispatch(setSyncing(false));
  }
});

export interface ResetResult {
  /** Products re-pulled from the API. */
  products: number;
  /** Unsent sales carried across the reset. */
  keptQueue: number;
}

/**
 * Reset the local cache, then re-pull everything from the API.
 *
 * The recovery path for a device whose cache has drifted from the backend: the
 * pull only upserts, so records deleted or re-keyed on the server linger locally
 * and keep showing stale values. Truncating first guarantees the next screen the
 * user opens reflects the API exactly. Unsent sales and device preferences
 * survive (see `resetDatabase`), and the cached profile is re-written from the
 * in-memory session so a reset performed offline can't strand the user at the
 * login screen on the next launch.
 *
 * Rejects if the re-pull fails, so the caller can tell the user the cache is now
 * empty and a sync is still owed — never silently leave a blank app behind.
 */
export const resetLocalData = createAsyncThunk<ResetResult>('sync/reset', async (_arg, { dispatch, getState }) => {
  const state = getState() as { auth: { status: string; me: Me | null } };
  if (running) throw new Error('A sync is already running');
  running = true;
  dispatch(setSyncing(true));
  try {
    await resetDatabase();
    if (state.auth.me) await kvSet('me', state.auth.me); // keep offline bootstrap alive
    const counts = await outbox.counts();
    dispatch(setCounts(counts));

    if (state.auth.status === 'authenticated') {
      // Profile + admin screen config first: they decide what the user may see.
      await dispatch(refreshMe());
      await dispatch(refreshMobileConfig());
      const snapshot = await pullCatalog();
      // Flush whatever the queue carried across — best-effort, the pull is what
      // this action promises, so a blocked drain must not read as a failed reset.
      try {
        const push = await pushOutbox();
        if (push.pushed || push.failed) dispatch(setCounts(await outbox.counts()));
      } catch {
        /* queue stays for the next sync */
      }
      dispatch(setLastSyncAt(Date.now()));
      return { products: snapshot.products, keptQueue: counts.pending + counts.failed };
    }
    dispatch(setLastSyncAt(Date.now()));
    return { products: 0, keptQueue: counts.pending + counts.failed };
  } finally {
    running = false;
    dispatch(setSyncing(false));
  }
});

export const submitOutbox = createAsyncThunk<OutboxRow, { kind: OutboxKind; payload: unknown; idempotencyKey?: string }>(
  'sync/submit',
  async ({ kind, payload, idempotencyKey }, { dispatch }) => {
    const row = await outbox.enqueue(kind, payload, idempotencyKey);
    dispatch(setCounts(await outbox.counts()));
    void dispatch(runSync()); // fire-and-forget; UI already has its optimistic result
    return row;
  },
);

export const retryFailed = createAsyncThunk('sync/retry', async (id: string, { dispatch }) => {
  await outbox.retry(id);
  dispatch(setCounts(await outbox.counts()));
  void dispatch(runSync());
});

export const discardFailed = createAsyncThunk('sync/discard', async (id: string, { dispatch }) => {
  await outbox.discard(id);
  dispatch(setCounts(await outbox.counts()));
});

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    setOnline(state, action: PayloadAction<boolean>) {
      state.online = action.payload;
    },
    setSyncing(state, action: PayloadAction<boolean>) {
      state.syncing = action.payload;
    },
    setCounts(state, action: PayloadAction<SyncCounts>) {
      state.counts = action.payload;
    },
    setLastSyncAt(state, action: PayloadAction<number>) {
      state.lastSyncAt = action.payload;
    },
  },
});

export const { setOnline, setSyncing, setCounts, setLastSyncAt } = syncSlice.actions;
export default syncSlice.reducer;
