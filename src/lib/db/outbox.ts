/**
 * Outbox repository — the durable queue behind offline-first writes. Every sale
 * (POS checkout, cart create/checkout, return create/post) is appended here with
 * a stable Idempotency-Key, then the sync engine replays entries FIFO when
 * online. The key makes replay safe: the backend's POS service dedupes on it, so
 * a retry collapses onto the first sale instead of double-charging.
 */
import { getDb } from './database';
import { uid } from '../format';
import type { OutboxKind, OutboxRow, OutboxStatus } from '../types';

export async function enqueue(kind: OutboxKind, payload: unknown, idempotencyKey?: string): Promise<OutboxRow> {
  const db = await getDb();
  const row: OutboxRow = {
    id: uid('ob_'),
    kind,
    payload: JSON.stringify(payload),
    idempotencyKey: idempotencyKey ?? uid('idem_'),
    status: 'pending',
    attempts: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
    result: null,
  };
  await db.runAsync(
    'INSERT INTO outbox (id, kind, payload, idempotencyKey, status, attempts, lastError, createdAt, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    row.id,
    row.kind,
    row.payload,
    row.idempotencyKey,
    row.status,
    row.attempts,
    row.lastError,
    row.createdAt,
    row.result,
  );
  return row;
}

/** Pending entries in submission order (FIFO) — what the sync engine drains. */
export async function pending(): Promise<OutboxRow[]> {
  const db = await getDb();
  return db.getAllAsync<OutboxRow>(
    "SELECT * FROM outbox WHERE status IN ('pending','syncing') ORDER BY createdAt ASC",
  );
}

export async function recent(limit = 30): Promise<OutboxRow[]> {
  const db = await getDb();
  return db.getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY createdAt DESC LIMIT ?', limit);
}

export async function counts(): Promise<{ pending: number; failed: number; done: number }> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ status: OutboxStatus; n: number }>(
    'SELECT status, COUNT(*) AS n FROM outbox GROUP BY status',
  );
  const out = { pending: 0, failed: 0, done: 0 };
  for (const r of rows) {
    if (r.status === 'pending' || r.status === 'syncing') out.pending += r.n;
    else if (r.status === 'failed') out.failed += r.n;
    else if (r.status === 'done') out.done += r.n;
  }
  return out;
}

export async function markSyncing(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE outbox SET status = ?, attempts = attempts + 1 WHERE id = ?', 'syncing', id);
}

export async function markDone(id: string, result: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE outbox SET status = ?, result = ?, lastError = NULL WHERE id = ?', 'done', JSON.stringify(result ?? null), id);
}

/** Re-queue (transient/offline failure) or hard-fail (server rejected it). */
export async function markFailed(id: string, error: string, retryable: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE outbox SET status = ?, lastError = ? WHERE id = ?', retryable ? 'pending' : 'failed', error, id);
}

/** Manually retry a hard-failed entry (user taps "retry"). */
export async function retry(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE outbox SET status = 'pending', lastError = NULL WHERE id = ?", id);
}

export async function discard(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM outbox WHERE id = ?', id);
}

/** Trim old completed entries so the table doesn't grow unbounded. */
export async function pruneDone(keep = 50): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "DELETE FROM outbox WHERE status = 'done' AND id NOT IN (SELECT id FROM outbox WHERE status = 'done' ORDER BY createdAt DESC LIMIT ?)",
    keep,
  );
}
