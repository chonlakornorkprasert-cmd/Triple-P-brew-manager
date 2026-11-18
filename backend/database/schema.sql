CREATE TABLE IF NOT EXISTS ingredients (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  purchase_qty NUMERIC(12,3) NOT NULL CHECK (purchase_qty > 0),
  purchase_unit VARCHAR(20) NOT NULL,
  purchase_price NUMERIC(12,2) NOT NULL CHECK (purchase_price >= 0),
  base_unit VARCHAR(20) NOT NULL,
  conversion_to_base NUMERIC(12,4) NOT NULL DEFAULT 1 CHECK (conversion_to_base > 0),
  reorder_level NUMERIC(12,3) NOT NULL DEFAULT 0,
  supplier VARCHAR(150),
  barcode VARCHAR(100),
  expiry_date DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS supplier VARCHAR(150);
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS stock_group VARCHAR(1) NOT NULL DEFAULT 'C';
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS purchase_cycle_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS count_cycle_days INTEGER NOT NULL DEFAULT 3;

CREATE TABLE IF NOT EXISTS recipes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  serving_size VARCHAR(30),
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  online_selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE recipes ADD COLUMN IF NOT EXISTS online_selling_price NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS sold_out BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS recipe_items (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  qty_base NUMERIC(12,3) NOT NULL CHECK (qty_base >= 0),
  UNIQUE(recipe_id, ingredient_id)
);

ALTER TABLE recipe_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS stock_transactions (
  id BIGSERIAL PRIMARY KEY,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  txn_type VARCHAR(20) NOT NULL CHECK (txn_type IN ('OPENING','PURCHASE','USE','ADJUST_IN','ADJUST_OUT','WASTE')),
  qty_base NUMERIC(12,3) NOT NULL CHECK (qty_base > 0),
  unit_cost NUMERIC(12,4),
  reference VARCHAR(100),
  note TEXT,
  txn_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_stock_counts (
  id BIGSERIAL PRIMARY KEY,
  count_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  expected_qty NUMERIC(12,3) NOT NULL,
  actual_qty NUMERIC(12,3) NOT NULL CHECK(actual_qty >= 0),
  variance_qty NUMERIC(12,3) NOT NULL,
  reason VARCHAR(200),
  counted_by VARCHAR(100) NOT NULL,
  counted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(count_date,ingredient_id)
);

-- Recreate costing views because new ingredient columns change the shape of i.*.
DROP VIEW IF EXISTS recipe_costs;
DROP VIEW IF EXISTS ingredient_costs;

CREATE VIEW ingredient_costs AS
SELECT i.*,
       CASE WHEN i.purchase_qty * i.conversion_to_base = 0 THEN 0
            ELSE i.purchase_price / (i.purchase_qty * i.conversion_to_base) END AS cost_per_base_unit
FROM ingredients i;

CREATE OR REPLACE VIEW stock_balances AS
SELECT i.id AS ingredient_id, i.sku, i.name, i.base_unit, i.reorder_level,
       COALESCE(SUM(CASE WHEN st.txn_type IN ('OPENING','PURCHASE','ADJUST_IN') THEN st.qty_base ELSE -st.qty_base END),0) AS stock_qty
FROM ingredients i
LEFT JOIN stock_transactions st ON st.ingredient_id=i.id
GROUP BY i.id;

CREATE VIEW recipe_costs AS
SELECT r.id AS recipe_id, r.code, r.name, r.category, r.serving_size, r.selling_price,
       r.online_selling_price,
       COALESCE(SUM(ri.qty_base * ic.cost_per_base_unit),0) AS recipe_cost,
       r.selling_price-COALESCE(SUM(ri.qty_base * ic.cost_per_base_unit),0) AS gross_profit,
       CASE WHEN r.selling_price=0 THEN 0 ELSE COALESCE(SUM(ri.qty_base * ic.cost_per_base_unit),0)/r.selling_price*100 END AS food_cost_pct,
       r.online_selling_price*0.679-COALESCE(SUM(ri.qty_base * ic.cost_per_base_unit),0) AS online_profit,
       r.sold_out
FROM recipes r
LEFT JOIN recipe_items ri ON ri.recipe_id=r.id
LEFT JOIN ingredient_costs ic ON ic.id=ri.ingredient_id
GROUP BY r.id;

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_type VARCHAR(30) NOT NULL,
  customer VARCHAR(100) NOT NULL,
  guest_count INTEGER,
  note TEXT,
  phone VARCHAR(30),
  delivery_address TEXT,
  requested_at TIMESTAMPTZ,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING','PREPARING','READY','COMPLETED','CANCELLED')),
  payment_method VARCHAR(20),
  paid_amount NUMERIC(12,2),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_count INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  recipe_id INTEGER REFERENCES recipes(id),
  menu_name VARCHAR(150) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) UNIQUE NOT NULL,
  seats INTEGER NOT NULL DEFAULT 2 CHECK (seats > 0),
  zone VARCHAR(80),
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','OCCUPIED','DISABLED')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGSERIAL PRIMARY KEY,
  po_number VARCHAR(40) UNIQUE NOT NULL,
  supplier VARCHAR(150) NOT NULL,
  expected_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','RECEIVED','CANCELLED')),
  note TEXT,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  quantity NUMERIC(12,3) NOT NULL CHECK(quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK(unit_price >= 0)
);

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_by VARCHAR(100);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS production_batches (
  id BIGSERIAL PRIMARY KEY,
  batch_code VARCHAR(50) UNIQUE NOT NULL,
  output_ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  output_qty NUMERIC(12,3) NOT NULL CHECK(output_qty > 0),
  input_ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
  input_qty NUMERIC(12,3) NOT NULL CHECK(input_qty > 0),
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT,
  produced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id=1),
  store_name VARCHAR(150) NOT NULL DEFAULT 'Triple P Brew',
  tax_id VARCHAR(30), phone VARCHAR(30), email VARCHAR(150), address TEXT,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  service_charge NUMERIC(5,2) NOT NULL DEFAULT 0,
  online_gp NUMERIC(5,2) NOT NULL DEFAULT 35,
  currency VARCHAR(10) NOT NULL DEFAULT 'THB',
  promptpay_type VARCHAR(20) DEFAULT 'PHONE', promptpay_id VARCHAR(50),
  receipt_prefix VARCHAR(20) DEFAULT 'TPP', receipt_footer VARCHAR(200) DEFAULT 'ขอบคุณที่ใช้บริการ',
  opening_time TIME DEFAULT '08:00', closing_time TIME DEFAULT '18:00',
  food_cost_target NUMERIC(5,2) DEFAULT 35, low_stock_alert BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO store_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
