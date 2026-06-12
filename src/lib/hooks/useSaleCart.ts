/**
 * Reusable sale-line state for POS / Cart / Returns. Scanning the same product
 * twice bumps its quantity; manual lines and edits are supported. Totals match
 * the backend's rounding.
 */
import { useCallback, useMemo, useState } from 'react';

import { cartTotals, uid, type CartTotals } from '@/lib/format';
import type { Product, SaleLine } from '@/lib/types';

export interface UseSaleCart {
  lines: SaleLine[];
  totals: CartTotals;
  addProduct: (p: Product, qty?: number) => void;
  addManual: (description: string, unitPrice: number, taxRate?: number) => void;
  setQty: (key: string, qty: number) => void;
  updateLine: (key: string, patch: Partial<SaleLine>) => void;
  remove: (key: string) => void;
  clear: () => void;
  setLines: (lines: SaleLine[]) => void;
}

export function lineFromProduct(p: Product, qty = 1): SaleLine {
  return {
    key: uid('ln_'),
    productId: p.id,
    description: p.name,
    qty,
    unitPrice: Number(p.unitPrice ?? 0),
    taxRate: Number(p.taxRate ?? 0),
  };
}

export function useSaleCart(initial: SaleLine[] = []): UseSaleCart {
  const [lines, setLines] = useState<SaleLine[]>(initial);

  const addProduct = useCallback((p: Product, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId && l.productId === p.id);
      if (existing) {
        return prev.map((l) => (l.key === existing.key ? { ...l, qty: l.qty + qty } : l));
      }
      return [lineFromProduct(p, qty), ...prev];
    });
  }, []);

  const addManual = useCallback((description: string, unitPrice: number, taxRate = 0) => {
    setLines((prev) => [{ key: uid('ln_'), productId: null, description, qty: 1, unitPrice, taxRate }, ...prev]);
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) => prev.flatMap((l) => (l.key === key ? (qty <= 0 ? [] : [{ ...l, qty }]) : [l])));
  }, []);

  const updateLine = useCallback((key: string, patch: Partial<SaleLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const totals = useMemo(() => cartTotals(lines), [lines]);

  return { lines, totals, addProduct, addManual, setQty, updateLine, remove, clear, setLines };
}
