/**
 * Resolve a scanned/typed code to a product. Offline-first: check the local
 * catalogue cache (which the sync engine keeps fresh, barcode→SKU like the
 * backend), then fall back to the live /pos/lookup endpoint when online.
 */
import { pos } from '@/lib/api/endpoints';
import { ApiRequestError } from '@/lib/api/client';
import { normalizeScan } from '@/lib/barcode/check-digit';
import { findByCode } from '@/lib/db/products';
import type { Product } from '@/lib/types';

export interface ResolveOutcome {
  product: Product | null;
  source: 'cache' | 'server' | 'none';
  offline: boolean;
}

export async function resolveProduct(code: string): Promise<ResolveOutcome> {
  const c = normalizeScan(code);
  if (!c) return { product: null, source: 'none', offline: false };

  const local = await findByCode(c);
  if (local) return { product: local, source: 'cache', offline: false };

  try {
    const { product } = await pos.lookup(c);
    return { product: product ?? null, source: product ? 'server' : 'none', offline: false };
  } catch (err) {
    const offline = err instanceof ApiRequestError && err.isNetwork;
    return { product: null, source: 'none', offline };
  }
}
