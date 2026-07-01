/**
 * Sync engine (offline-first core, point 3).
 *
 *  - PUSH: drains the outbox FIFO, one entry at a time (sequential — preserves
 *    order and is gentle on battery/network). Each entry carries a stable
 *    Idempotency-Key so a retry never double-posts a sale. A transient/network
 *    failure re-queues the entry and stops the drain (we'll retry on the next
 *    online event); a 4xx is a hard reject surfaced to the user.
 *  - PULL: refreshes the local product catalogue + reference lists + stock so the
 *    scanner and stock screens work offline.
 *
 * Pure functions here; React wiring lives in SyncProvider.
 */
import { ApiRequestError } from '../api/client';
import { carts, entities, inventory, pos, returns } from '../api/endpoints';
import type { CartLineInput, PosCheckoutBody } from '../api/endpoints';
import { kvSet } from '../db/database';
import * as outbox from '../db/outbox';
import { upsertProducts, upsertStock } from '../db/products';
import type { Account, Branch, Dealer, OutboxRow, Payment, Product, Warehouse } from '../types';

export interface PushResult {
  pushed: number;
  failed: number;
  blocked: boolean; // stopped early because of a transient failure (still offline?)
}

/** Replay one outbox entry against the API. Throws ApiRequestError on failure. */
async function dispatch(row: OutboxRow): Promise<unknown> {
  const payload = JSON.parse(row.payload) as Record<string, unknown>;
  switch (row.kind) {
    case 'pos.checkout':
      return pos.checkout({ ...(payload as unknown as PosCheckoutBody), idempotencyKey: row.idempotencyKey }, { timeoutMs: 30_000 });
    case 'cart.create':
      return carts.create(payload as { lines?: CartLineInput[] });
    case 'cart.checkout':
      return carts.checkout(String(payload.id), payload.payments as Payment[], row.idempotencyKey);
    case 'return.create':
      return returns.create({ ...(payload as { lines: CartLineInput[] }), idempotencyKey: row.idempotencyKey });
    case 'return.post':
      return returns.post(String(payload.id));
    default:
      throw new ApiRequestError('UNKNOWN_KIND', 422, `unknown outbox kind ${row.kind}`);
  }
}

export async function pushOutbox(): Promise<PushResult> {
  const queue = await outbox.pending();
  let pushed = 0;
  let failed = 0;
  for (const row of queue) {
    await outbox.markSyncing(row.id);
    try {
      const result = await dispatch(row);
      await outbox.markDone(row.id, result);
      pushed++;
    } catch (err) {
      const e = err instanceof ApiRequestError ? err : new ApiRequestError('ERROR', 500, String(err));
      // Network / timeout / 5xx → transient: re-queue and stop draining (still offline / server down).
      const retryable = e.isNetwork || e.status >= 500 || e.status === 429;
      await outbox.markFailed(row.id, e.message, retryable);
      if (retryable) {
        return { pushed, failed, blocked: true };
      }
      failed++; // 4xx: hard reject, leave failed and continue with the rest.
    }
  }
  await outbox.pruneDone();
  return { pushed, failed, blocked: false };
}

export interface CatalogSnapshot {
  products: number;
  branches: Branch[];
  warehouses: Warehouse[];
  dealers: Dealer[];
  accounts: Account[];
}

/**
 * Backend clamps any list to MAX_PAGE_SIZE (200), so a single big-`pageSize`
 * request silently truncates the catalogue — which would leave products beyond
 * the 200th unresolvable offline. Page through in 200-row batches until a short
 * page signals the end, so the offline cache is complete for barcode lookup.
 */
const PAGE_SIZE = 200;
async function fetchAll<T>(entity: string): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= 1000; page++) {
    const res = await entities.list<T>(entity, { page, pageSize: PAGE_SIZE });
    const items = res.items ?? [];
    all.push(...items);
    if (items.length < PAGE_SIZE) break; // last (short) page reached
  }
  return all;
}

/** Pull catalogue + reference data into the local cache for offline use. */
export async function pullCatalog(): Promise<CatalogSnapshot> {
  const [products, branches, warehouses, dealers, accounts] = await Promise.all([
    fetchAll<Product>('product'),
    fetchAll<Branch>('branch'),
    fetchAll<Warehouse>('warehouse'),
    fetchAll<Dealer>('dealer'),
    fetchAll<Account>('account'),
  ]);
  await upsertProducts(products);
  await Promise.all([
    kvSet('branches', branches),
    kvSet('warehouses', warehouses),
    kvSet('dealers', dealers),
    kvSet('accounts', accounts),
    kvSet('catalog.syncedAt', new Date().toISOString()),
  ]);
  // Stock is best-effort (a role may lack inventory read).
  try {
    const { rows } = await inventory.onHand();
    await upsertStock(rows ?? []);
  } catch {
    /* ignore — role may not have inventory:read */
  }
  return { products: products.length, branches, warehouses, dealers, accounts };
}
