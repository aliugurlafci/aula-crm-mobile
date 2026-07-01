/**
 * redux-persist storage engine backed by the app's existing SQLite `kv` table —
 * so persisted Redux state (settings, cached config) lives in the same durable
 * store as the offline catalogue/outbox, with no extra native dependency
 * (AsyncStorage). Values are opaque strings from redux-persist; `kvSet` JSON-
 * encodes and `kvGet` decodes, round-tripping the string faithfully.
 */
import type { Storage } from 'redux-persist';
import { kvGet, kvSet } from '@/lib/db/database';

export const kvStorage: Storage = {
  getItem: (key: string) => kvGet<string>(key),
  setItem: (key: string, value: string) => kvSet(key, value),
  removeItem: (key: string) => kvSet(key, null),
};
