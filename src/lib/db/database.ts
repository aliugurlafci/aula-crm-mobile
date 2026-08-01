/**
 * SQLite handle (expo-sqlite async API). A single shared connection is opened
 * lazily and the schema applied once. All repos await `getDb()`.
 */
import * as SQLite from 'expo-sqlite';

import { SCHEMA_SQL, USER_VERSION } from './schema';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('aula-pos.db');
  await db.execAsync(SCHEMA_SQL);
  // Lightweight versioned-migration hook for future schema changes.
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current < USER_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${USER_VERSION}`);
  }
  return db;
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) dbPromise = open();
  return dbPromise;
}

export interface ResetOptions {
  /** Keep unsent outbox entries (queued + failed sales). Default true. */
  keepQueue?: boolean;
  /** Keep the redux-persist rows in `kv` (theme / language / server prefs). Default true. */
  keepPreferences?: boolean;
}

/**
 * Truncate every local table so the next sync repopulates the cache from the
 * API. Needed because the pull path only ever *upserts*: a record deleted,
 * renamed or re-keyed on the backend has no counterpart event here, so it would
 * otherwise survive locally forever and drift from what the API defines.
 *
 * Two things are deliberately spared by default — unsent sales (deleting them
 * loses money) and the persisted UI/server preferences (they aren't API data,
 * and wiping them would reset the backend URL row and the theme). The table list
 * is read from `sqlite_master` rather than hardcoded, so a table added later is
 * never silently left behind.
 */
export async function resetDatabase({ keepQueue = true, keepPreferences = true }: ResetOptions = {}): Promise<void> {
  const db = await getDb();
  const tables = await db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  );
  await db.withTransactionAsync(async () => {
    for (const { name } of tables) {
      if (name === 'outbox' && keepQueue) {
        await db.runAsync("DELETE FROM outbox WHERE status = 'done'");
      } else if (name === 'kv' && keepPreferences) {
        await db.runAsync("DELETE FROM kv WHERE k NOT LIKE 'persist:%'");
      } else {
        // Identifier comes from sqlite_master, never from user input.
        await db.runAsync(`DELETE FROM ${name}`);
      }
    }
  });
  // Reclaim the freed pages; best-effort (VACUUM cannot run inside a transaction).
  await db.execAsync('VACUUM').catch(() => {});
}

// ---- generic KV cache -----------------------------------------------------
export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO kv (k, v, updatedAt) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, updatedAt = excluded.updatedAt',
    key,
    JSON.stringify(value),
    new Date().toISOString(),
  );
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ v: string }>('SELECT v FROM kv WHERE k = ?', key);
  if (!row?.v) return null;
  try {
    return JSON.parse(row.v) as T;
  } catch {
    return null;
  }
}
