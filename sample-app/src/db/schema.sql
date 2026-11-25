-- ShopLite schema. Monetary values are stored as integer cents to avoid floating point errors.

CREATE TABLE IF NOT EXISTS customers (
  id            BIGSERIAL PRIMARY KEY,
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  phone         VARCHAR(30),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id          BIGSERIAL PRIMARY KEY,
  sku         VARCHAR(40) NOT NULL UNIQUE,
  name        VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category    VARCHAR(60) NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  stock       INTEGER NOT NULL CHECK (stock >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carts (
  id          BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status      VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CHECKED_OUT')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A customer may have at most one open cart.
CREATE UNIQUE INDEX IF NOT EXISTS carts_one_open_per_customer
  ON carts (customer_id) WHERE status = 'OPEN';

CREATE TABLE IF NOT EXISTS cart_items (
  cart_id          BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id       BIGINT NOT NULL REFERENCES products(id),
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  PRIMARY KEY (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id                 BIGSERIAL PRIMARY KEY,
  order_number       VARCHAR(30) NOT NULL UNIQUE,
  customer_id        BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status             VARCHAR(20) NOT NULL DEFAULT 'PLACED' CHECK (status IN ('PLACED', 'CANCELLED')),
  subtotal_cents     INTEGER NOT NULL,
  tax_cents          INTEGER NOT NULL,
  total_cents        INTEGER NOT NULL,
  shipping_name      VARCHAR(200) NOT NULL,
  shipping_address   VARCHAR(300) NOT NULL,
  shipping_city      VARCHAR(100) NOT NULL,
  shipping_postcode  VARCHAR(20) NOT NULL,
  shipping_country   VARCHAR(60) NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id         BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id       BIGINT NOT NULL REFERENCES products(id),
  product_name     VARCHAR(200) NOT NULL,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL,
  line_total_cents INTEGER NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
