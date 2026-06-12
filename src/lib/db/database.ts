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

/** Wipe all local data (used on logout). Keeps the schema. */
export async function clearLocalData(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM products; DELETE FROM stock; DELETE FROM kv; DELETE FROM outbox;');
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
