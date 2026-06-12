/**
 * Local SQLite schema (offline-first store). One statement block run via
 * `execAsync` on open. `IF NOT EXISTS` everywhere keeps open idempotent; bump
 * USER_VERSION + add migrations in database.ts when the shape changes.
 */
export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS products (
  id           TEXT PRIMARY KEY NOT NULL,
  name         TEXT NOT NULL,
  sku          TEXT,
  barcode      TEXT,
  unitPrice    REAL,
  taxRate      REAL,
  currencyCode TEXT,
  reorderLevel REAL,
  active       INTEGER,
  imageId      TEXT,
  json         TEXT,
  updatedAt    TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name);

CREATE TABLE IF NOT EXISTS stock (
  productId   TEXT NOT NULL,
  warehouseId TEXT NOT NULL,
  onHand      REAL,
  json        TEXT,
  PRIMARY KEY (productId, warehouseId)
);

-- Generic JSON cache for small reference lists + sync cursors/metadata.
CREATE TABLE IF NOT EXISTS kv (
  k         TEXT PRIMARY KEY NOT NULL,
  v         TEXT,
  updatedAt TEXT
);

-- Outbox: durable queue of mutations made offline, replayed in FIFO order.
CREATE TABLE IF NOT EXISTS outbox (
  id             TEXT PRIMARY KEY NOT NULL,
  kind           TEXT NOT NULL,
  payload        TEXT NOT NULL,
  idempotencyKey TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  attempts       INTEGER NOT NULL DEFAULT 0,
  lastError      TEXT,
  createdAt      TEXT NOT NULL,
  result         TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox (status, createdAt);
`;

export const USER_VERSION = 1;
