-- Walmart Data Ventures prototype — schema setup.
-- Run this once in the Supabase SQL editor. Re-run to reset state.

-- Drop in reverse dependency order for clean re-runs
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS forecasts CASCADE;
DROP TABLE IF EXISTS raw_ecommerce_orders CASCADE;
DROP TABLE IF EXISTS raw_pos_transactions CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;

-- =========================================================
-- Reference tables
-- =========================================================

CREATE TABLE suppliers (
  supplier_id     INTEGER PRIMARY KEY,
  supplier_name   TEXT NOT NULL,
  contact_email   TEXT,
  region          TEXT
);

CREATE TABLE stores (
  store_id        TEXT PRIMARY KEY,
  store_name      TEXT NOT NULL,
  city            TEXT,
  state           TEXT,
  region          TEXT,                             -- e.g., 'Midwest', 'Southeast', 'West'
  store_type      TEXT                              -- 'retail' or 'fulfillment_center'
);

CREATE TABLE products (
  product_id       TEXT PRIMARY KEY,                -- UPC as string; preserves leading zeros
  product_name     TEXT NOT NULL,
  category         TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,                -- wholesale cost, in cents
  supplier_id      INTEGER REFERENCES suppliers(supplier_id)
);

CREATE TABLE forecasts (
  forecast_id         BIGSERIAL PRIMARY KEY,
  product_id          TEXT REFERENCES products(product_id),
  store_id            TEXT REFERENCES stores(store_id),
  week_start          DATE NOT NULL,
  forecasted_units    INTEGER NOT NULL,
  forecasted_revenue  NUMERIC(10,2) NOT NULL
);

-- =========================================================
-- Raw staging tables
-- =========================================================

CREATE TABLE raw_pos_transactions (
  raw_id               BIGSERIAL PRIMARY KEY,
  transaction_id       TEXT,
  store_id             TEXT,
  timestamp_raw        TEXT,                        -- intentionally TEXT: mixed formats
  upc_or_name          TEXT,                        -- usually UPC, sometimes an abbreviation
  quantity             INTEGER,
  price_charged_cents  INTEGER,
  ingested_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE raw_ecommerce_orders (
  raw_id          BIGSERIAL PRIMARY KEY,
  order_id        TEXT,
  placed_at       TIMESTAMPTZ,
  customer_id     TEXT,
  loyalty_tier    TEXT,
  items_json      JSONB,                            -- nested items array preserved
  fulfillment     TEXT,                             -- 'delivery', 'pickup', 'ship'
  store_id        TEXT,                             -- nullable for delivery/ship
  ingested_at     TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- Clean analytical table
-- =========================================================

CREATE TABLE transactions (
  transaction_id   TEXT PRIMARY KEY,                -- line item ID
  order_id         TEXT NOT NULL,                   -- groups line items from same order
  product_id       TEXT NOT NULL REFERENCES products(product_id),
  product_name     TEXT NOT NULL,                   -- denormalized from products
  category         TEXT NOT NULL,                   -- denormalized from products
  sale_date        DATE NOT NULL,
  sale_timestamp   TIMESTAMPTZ NOT NULL,
  quantity         INTEGER NOT NULL,
  unit_price       NUMERIC(10,2) NOT NULL,          -- wholesale, in dollars
  sale_price       NUMERIC(10,2) NOT NULL,          -- retail, in dollars
  store_id         TEXT NOT NULL REFERENCES stores(store_id),
  region           TEXT,                            -- denormalized from stores
  customer_id      TEXT,                            -- nullable: anonymous POS cash purchases
  channel          TEXT NOT NULL CHECK (channel IN ('pos', 'ecommerce')),
  inserted_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_order     ON transactions(order_id);
CREATE INDEX idx_transactions_sale_date ON transactions(sale_date);
CREATE INDEX idx_transactions_product   ON transactions(product_id);
CREATE INDEX idx_transactions_store     ON transactions(store_id);
CREATE INDEX idx_transactions_category  ON transactions(category);
CREATE INDEX idx_transactions_region    ON transactions(region);
