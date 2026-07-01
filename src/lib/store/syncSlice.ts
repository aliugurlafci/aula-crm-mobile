/**
 * Sync slice — mirrors the offline sync engine's state into the store and drives
 * it via thunks. The durable outbox + SQLite catalogue (the offline core) are
 * unchanged; this only owns the online/syncing/counts UI state and the single
 * `submit` write path. A module-level guard keeps concurrent syncs from
 * overlapping (as the old provider's ref did). `useSync()` keeps its old shape.
 */
import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import * as outbox from '@/lib/db/outbox';
import { pullCatalog, pushOutbox } from '@/lib/sync/engine';
import type { OutboxKind, OutboxRow } from '@/lib/types';

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
