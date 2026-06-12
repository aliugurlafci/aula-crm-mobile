/**
 * Local product catalogue cache — lets the scanner resolve a barcode/SKU to a
 * product while offline (mirrors the backend's `pos.lookup`: barcode first, then
 * SKU). Refreshed by the sync engine when online.
 */
import { getDb } from './database';
import type { Product, StockRow } from '../types';

function rowToProduct(json: string): Product | null {
  try {
    return JSON.parse(json) as Product;
  } catch {
    return null;
  }
}

export async function upsertProducts(products: Product[]): Promise<number> {
  if (!products.length) return 0;
  const db = await getDb();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const stmt = await db.prepareAsync(
      `INSERT INTO products (id, name, sku, barcode, unitPrice, taxRate, currencyCode, reorderLevel, active, imageId, json, updatedAt)
       VALUES ($id, $name, $sku, $barcode, $unitPrice, $taxRate, $currencyCode, $reorderLevel, $active, $imageId, $json, $updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, sku=excluded.sku, barcode=excluded.barcode, unitPrice=excluded.unitPrice,
         taxRate=excluded.taxRate, currencyCode=excluded.currencyCode, reorderLevel=excluded.reorderLevel,
         active=excluded.active, imageId=excluded.imageId, json=excluded.json, updatedAt=excluded.updatedAt`,
    );
    try {
      for (const p of products) {
        await stmt.executeAsync({
          $id: p.id,
          $name: p.name ?? '',
          $sku: p.sku ?? null,
          $barcode: p.barcode ?? null,
          $unitPrice: p.unitPrice ?? null,
          $taxRate: p.taxRate ?? null,
          $currencyCode: p.currencyCode ?? null,
          $reorderLevel: p.reorderLevel ?? null,
          $active: p.active === false ? 0 : 1,
          $imageId: p.imageId ?? null,
          $json: JSON.stringify(p),
          $updatedAt: now,
        });
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });
  return products.length;
}

/** Resolve a scanned code: exact barcode match, then SKU (offline lookup). */
export async function findByCode(code: string): Promise<Product | null> {
  const c = (code ?? '').trim();
  if (!c) return null;
  const db = await getDb();
  const byBarcode = await db.getFirstAsync<{ json: string }>('SELECT json FROM products WHERE barcode = ? LIMIT 1', c);
  if (byBarcode?.json) return rowToProduct(byBarcode.json);
  const bySku = await db.getFirstAsync<{ json: string }>('SELECT json FROM products WHERE sku = ? COLLATE NOCASE LIMIT 1', c);
  return bySku?.json ? rowToProduct(bySku.json) : null;
}

export async function getProduct(id: string): Promise<Product | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ json: string }>('SELECT json FROM products WHERE id = ? LIMIT 1', id);
  return row?.json ? rowToProduct(row.json) : null;
}

/** Text search by name / sku / barcode (for the POS search bar). */
export async function searchProducts(term: string, limit = 50): Promise<Product[]> {
  const db = await getDb();
  const t = (term ?? '').trim();
  if (!t) {
    const rows = await db.getAllAsync<{ json: string }>('SELECT json FROM products ORDER BY name LIMIT ?', limit);
    return rows.map((r) => rowToProduct(r.json)).filter(Boolean) as Product[];
  }
  const like = `%${t}%`;
  const rows = await db.getAllAsync<{ json: string }>(
    `SELECT json FROM products
     WHERE name LIKE ? COLLATE NOCASE OR sku LIKE ? COLLATE NOCASE OR barcode LIKE ?
     ORDER BY name LIMIT ?`,
    like,
    like,
    like,
    limit,
  );
  return rows.map((r) => rowToProduct(r.json)).filter(Boolean) as Product[];
}

export async function productCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM products');
  return row?.n ?? 0;
}

// ---- stock cache ----------------------------------------------------------
export async function upsertStock(rows: StockRow[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM stock');
    const stmt = await db.prepareAsync(
      'INSERT OR REPLACE INTO stock (productId, warehouseId, onHand, json) VALUES ($p, $w, $o, $j)',
    );
    try {
      for (const r of rows) {
        await stmt.executeAsync({ $p: r.productId, $w: r.warehouseId, $o: r.onHand, $j: JSON.stringify(r) });
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });
}

export async function stockForProduct(productId: string): Promise<StockRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ json: string }>('SELECT json FROM stock WHERE productId = ?', productId);
  return rows.map((r) => JSON.parse(r.json) as StockRow);
}

export async function allStock(): Promise<StockRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ json: string }>('SELECT json FROM stock ORDER BY onHand ASC');
  return rows.map((r) => JSON.parse(r.json) as StockRow);
}

/** Total on-hand for a product across warehouses (quick stock badge). */
export async function onHandTotal(productId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(onHand),0) AS total FROM stock WHERE productId = ?', productId);
  return row?.total ?? 0;
}
