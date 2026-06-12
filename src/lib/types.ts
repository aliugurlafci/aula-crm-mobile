/**
 * Shared domain types mirroring the backend's entity/record shapes (see
 * Backend/src/lib/metadata/entities/*). Records are intentionally loose
 * (`EntityRecord`) because the backend is metadata-driven; the narrowed
 * interfaces below capture the fields the mobile screens rely on.
 */
export type Id = string;

export type EntityRecord = Record<string, unknown> & { id: Id; version?: number };

export interface Product {
  id: Id;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unitPrice?: number | null;
  taxRate?: number | null;
  currencyCode?: string | null;
  reorderLevel?: number | null;
  active?: boolean | null;
  imageId?: string | null;
}

export interface Branch {
  id: Id;
  name: string;
}

export interface Warehouse {
  id: Id;
  name: string;
  branchId?: string | null;
}

export interface Dealer {
  id: Id;
  name: string;
}

export interface Account {
  id: Id;
  name: string;
}

/** A line in a POS sale / cart / return. */
export interface SaleLine {
  /** Stable client-side key (uuid) so React lists + qty edits are stable offline. */
  key: string;
  productId: Id | null;
  description: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
}

export type PaymentMethod = 'cash' | 'card' | 'other';

export interface Payment {
  method: PaymentMethod;
  amount: number;
}

export interface PosSession {
  id: Id;
  number?: string;
  branchId?: string | null;
  warehouseId?: string | null;
  cashierId?: string | null;
  status?: 'open' | 'closed';
  openingFloat?: number;
  salesTotal?: number;
  cashTotal?: number;
  expectedCash?: number;
  variance?: number;
  openedAt?: string | null;
  closedAt?: string | null;
}

export interface CheckoutResult {
  invoice: EntityRecord;
  lines?: EntityRecord[];
  total: number;
  paid?: number;
  change: number;
}

/** A row from GET /inventory/on-hand. */
export interface StockRow {
  productId: Id;
  productName: string;
  sku: string;
  barcode: string;
  warehouseId: Id;
  warehouseName: string;
  branchId: string | null;
  branchName: string;
  onHand: number;
  value: number;
  reorderLevel: number;
  low: boolean;
}

/** The authenticated user profile from GET /auth/me. */
export interface Me {
  userId: Id;
  displayName: string;
  email: string;
  roles: string[];
  tenantId: string;
  orgId: string;
  locale?: string;
  positionId?: string | null;
  position?: { id: string; name: string; role: string } | null;
  screens: string[];
  grants: string[];
  jobTitle?: string | null;
  twoFactorEnabled?: boolean;
  settings?: Record<string, string>;
}

/** Sale documents that can be queued offline and replayed. */
export type OutboxKind = 'pos.checkout' | 'cart.create' | 'cart.checkout' | 'return.create' | 'return.post';

export type OutboxStatus = 'pending' | 'syncing' | 'done' | 'failed';

export interface OutboxRow {
  id: string;
  kind: OutboxKind;
  /** JSON-encoded request payload. */
  payload: string;
  idempotencyKey: string;
  status: OutboxStatus;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  /** JSON-encoded server response once synced (for receipts). */
  result: string | null;
}
