/**
 * Typed wrappers over every backend endpoint the mobile app uses. Paths + shapes
 * mirror Backend/src/http/api.ts exactly. List queries follow the backend's
 * `?q=&page=&pageSize=&sort=field:dir&filter.<field>=value` convention.
 */
import { apiFetch, type ApiOptions } from './client';
import type {
  Account,
  Branch,
  CheckoutResult,
  Dealer,
  EntityRecord,
  Id,
  Me,
  MobileConfig,
  Payment,
  PosSession,
  Product,
  StockRow,
  Warehouse,
} from '../types';

// ---- list query helpers ---------------------------------------------------
export interface ListQuery {
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: { field: string; dir: 'asc' | 'desc' }[];
  filters?: Record<string, string | number | boolean>;
}

export interface Page<T> {
  items: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}

function listQs(query: ListQuery = {}): string {
  const sp = new URLSearchParams();
  if (query.q) sp.set('q', query.q);
  if (query.page) sp.set('page', String(query.page));
  if (query.pageSize) sp.set('pageSize', String(query.pageSize));
  for (const s of query.sort ?? []) sp.append('sort', `${s.field}:${s.dir}`);
  for (const [field, value] of Object.entries(query.filters ?? {})) {
    sp.set(`filter.${field}`, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// ---- auth -----------------------------------------------------------------
export interface LoginResponse {
  /** Persona/dev login returns the bearer token in the body. */
  token?: string;
  tokenType?: string;
  expiresIn?: number;
  user?: { userId?: Id; id?: Id; displayName?: string; email?: string; roles?: string[] };
  position?: { id: string; name: string; role: string } | null;
  screens?: string[];
  twoFactorRequired?: boolean;
}

export const auth = {
  login: (email: string, password: string, code?: string) =>
    apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: { email, password, code } }),
  /** Dev/demo persona login — returns a real signed bearer token in the body. */
  loginPersona: (actor: string) =>
    apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: { actor } }),
  me: () => apiFetch<Me>('/auth/me'),
  logout: () => apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  screens: () => apiFetch<{ screens: { key: string; label: string; group: string }[] }>('/screens'),
  /** Upsert per-user settings (theme/language/…) on the server, scoped to caller. */
  updateSettings: (settings: Record<string, string>) =>
    apiFetch<{ settings: Record<string, string> }>('/auth/settings', { method: 'PATCH', body: { settings } }),
};

// ---- mobile screen configuration ------------------------------------------
export const mobile = {
  /** The screens this user may see on mobile (admin config ∩ permissions) + a
   *  version stamp the app polls to pick up admin changes. */
  config: (clientId = 'mobile') =>
    apiFetch<MobileConfig>(`/mobile/config?clientId=${encodeURIComponent(clientId)}`),
};

// ---- generic entity CRUD --------------------------------------------------
export const entities = {
  list: <T = EntityRecord>(entity: string, query?: ListQuery) =>
    apiFetch<Page<T>>(`/entities/${entity}${listQs(query)}`),
  get: <T = EntityRecord>(entity: string, id: Id) => apiFetch<T>(`/entities/${entity}/${id}`),
  create: <T = EntityRecord>(entity: string, body: Record<string, unknown>) =>
    apiFetch<T>(`/entities/${entity}`, { method: 'POST', body }),
  update: <T = EntityRecord>(entity: string, id: Id, body: Record<string, unknown>, version?: number) =>
    apiFetch<T>(`/entities/${entity}/${id}`, {
      method: 'PATCH',
      body,
      headers: version != null ? { 'if-match': String(version) } : undefined,
    }),
  remove: (entity: string, id: Id) => apiFetch<{ ok: boolean }>(`/entities/${entity}/${id}`, { method: 'DELETE' }),
};

// ---- catalog (cached locally for offline POS) -----------------------------
export const catalog = {
  products: (query?: ListQuery) =>
    entities.list<Product>('product', { pageSize: 1000, ...query }),
  branches: () => entities.list<Branch>('branch', { pageSize: 200 }),
  warehouses: () => entities.list<Warehouse>('warehouse', { pageSize: 200 }),
  dealers: () => entities.list<Dealer>('dealer', { pageSize: 500 }),
  accounts: () => entities.list<Account>('account', { pageSize: 500 }),
};

// ---- point of sale --------------------------------------------------------
export interface PosCheckoutBody {
  branchId?: string | null;
  warehouseId?: string | null;
  dealerId?: string | null;
  accountId?: string | null;
  sessionId?: string | null;
  currencyCode?: string;
  lines: { productId: string | null; description: string; qty: number; unitPrice: number; taxRate: number }[];
  payments: Payment[];
  idempotencyKey?: string | null;
}

export const pos = {
  lookup: (code: string) => apiFetch<{ product: Product }>(`/pos/lookup?code=${encodeURIComponent(code)}`),
  session: () => apiFetch<{ session: PosSession | null }>('/pos/session'),
  openSession: (body: { branchId?: string | null; warehouseId?: string | null; openingFloat?: number }) =>
    apiFetch<{ session: PosSession }>('/pos/session/open', { method: 'POST', body }),
  closeSession: (sessionId: string, countedCash: number) =>
    apiFetch<{ session: PosSession }>('/pos/session/close', { method: 'POST', body: { sessionId, countedCash } }),
  checkout: (body: PosCheckoutBody, opts?: ApiOptions) =>
    apiFetch<CheckoutResult>('/pos/checkout', {
      method: 'POST',
      body,
      headers: body.idempotencyKey ? { 'idempotency-key': body.idempotencyKey } : undefined,
      ...opts,
    }),
};

// ---- carts (Sepet) --------------------------------------------------------
export interface CartLineInput {
  productId?: string | null;
  description?: string;
  qty: number;
  unitPrice: number;
  taxRate: number;
}

export const carts = {
  list: () => apiFetch<Page<EntityRecord>>('/carts'),
  get: (id: Id) => apiFetch<{ doc: EntityRecord; lines: EntityRecord[] }>(`/carts/${id}`),
  create: (body: {
    accountId?: string | null;
    branchId?: string | null;
    warehouseId?: string | null;
    currencyCode?: string;
    notes?: string | null;
    lines?: CartLineInput[];
  }) => apiFetch<{ doc: EntityRecord; lines: EntityRecord[] }>('/carts', { method: 'POST', body }),
  update: (id: Id, body: { header?: Record<string, unknown>; lines?: CartLineInput[] }) =>
    apiFetch<{ doc: EntityRecord; lines: EntityRecord[] }>(`/carts/${id}`, { method: 'PUT', body }),
  remove: (id: Id) => apiFetch<{ ok: boolean }>(`/carts/${id}`, { method: 'DELETE' }),
  checkout: (id: Id, payments: Payment[], idempotencyKey?: string) =>
    apiFetch<{ invoice: EntityRecord; total: number; change: number }>(`/carts/${id}/checkout`, {
      method: 'POST',
      body: { payments },
      headers: idempotencyKey ? { 'idempotency-key': idempotencyKey } : undefined,
    }),
};

// ---- sales returns (İadeler) ----------------------------------------------
export const returns = {
  list: () => apiFetch<Page<EntityRecord>>('/sales-returns'),
  get: (id: Id) => apiFetch<{ doc: EntityRecord; lines: EntityRecord[] }>(`/sales-returns/${id}`),
  create: (body: {
    accountId?: string | null;
    warehouseId?: string | null;
    branchId?: string | null;
    currencyCode?: string;
    reason?: string;
    lines: CartLineInput[];
    idempotencyKey?: string;
  }) =>
    apiFetch<{ doc: EntityRecord; lines: EntityRecord[] }>('/sales-returns', {
      method: 'POST',
      body,
      headers: body.idempotencyKey ? { 'idempotency-key': body.idempotencyKey } : undefined,
    }),
  post: (id: Id) => apiFetch<unknown>(`/sales-returns/${id}/post`, { method: 'POST', body: {} }),
};

// ---- inventory ------------------------------------------------------------
export const inventory = {
  onHand: (filters?: { branchId?: string; warehouseId?: string; lowStock?: boolean }) => {
    const sp = new URLSearchParams();
    if (filters?.branchId) sp.set('branchId', filters.branchId);
    if (filters?.warehouseId) sp.set('warehouseId', filters.warehouseId);
    if (filters?.lowStock) sp.set('lowStock', 'true');
    const qs = sp.toString();
    return apiFetch<{ rows: StockRow[] }>(`/inventory/on-hand${qs ? `?${qs}` : ''}`);
  },
};

// ---- dashboard stats ------------------------------------------------------
export interface StatsResponse {
  counts?: { account?: number; deal?: number; task?: number };
  pipelineByStage?: Record<string, { count: number; value: number }>;
  openPipeline?: number;
  wonValue?: number;
  cachedAt?: string;
}

export const stats = {
  get: () => apiFetch<StatsResponse>('/stats'),
};

// ---- activity feed --------------------------------------------------------
export interface ActivityEntry {
  entity?: string;
  action?: string;
  actorId?: string;
  actorName?: string;
  at?: string;
  recordId?: string;
  summary?: string;
  [key: string]: unknown;
}

export const activity = {
  list: (limit = 20) => apiFetch<{ entries: ActivityEntry[] }>(`/activity?limit=${limit}`),
};
