import type { DatabaseClient } from '../../../database/database-client';
import { TEST_EMAIL_DOMAIN } from '../../../data/builders/customer.builder';
import { TEST_PRODUCT_SKU_PREFIX, type ProductData } from '../../../data/builders/product.builder';
import type { Email } from '../../../data/value-objects/email';
import type { CartId, CustomerId, OrderId, ProductId } from '../ids';
import type { OrderNumber } from '../value-objects/order-number';

// Row shapes as stored. Column aliases in the SQL map snake_case to these names,
// so no mapping code is needed and the SQL shows exactly what is read.

export interface CustomerRow {
  id: CustomerId;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductRow extends ProductData {
  id: ProductId;
}

export interface CartRow {
  id: CartId;
  customerId: CustomerId;
  status: 'OPEN' | 'CHECKED_OUT';
}

export interface CartItemRow {
  productId: ProductId;
  quantity: number;
  unitPriceCents: number;
}

export interface OrderRow {
  id: OrderId;
  orderNumber: string;
  customerId: CustomerId;
  status: 'PLACED' | 'CANCELLED';
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingPostcode: string;
  shippingCountry: string;
  createdAt: Date;
}

export interface OrderItemRow {
  productId: ProductId;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

const CUSTOMER_COLUMNS = `id, email, password_hash AS "passwordHash", first_name AS "firstName", last_name AS "lastName",
  phone, created_at AS "createdAt", updated_at AS "updatedAt"`;
const PRODUCT_COLUMNS = `id, sku, name, description, category, price_cents AS "priceCents", stock`;

const TEST_EMAIL_PATTERN = `%@${TEST_EMAIL_DOMAIN}`;

export class CustomerRepository {
  constructor(private readonly db: DatabaseClient) {}

  findById(id: CustomerId): Promise<CustomerRow | undefined> {
    return this.db.maybeOne<CustomerRow>(`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE id = $1`, [id]);
  }

  // Takes an Email, not a string: the column holds normalised addresses, so lookups must be normalised too.
  findByEmail(email: Email): Promise<CustomerRow | undefined> {
    return this.db.maybeOne<CustomerRow>(`SELECT ${CUSTOMER_COLUMNS} FROM customers WHERE email = $1`, [email.value]);
  }

  /** Test customers left behind by aborted runs. The age limit protects customers of runs still in progress. */
  deleteStaleTestCustomers(olderThanMinutes: number): Promise<number> {
    return this.db.execute(
      `DELETE FROM customers WHERE email LIKE $1 AND created_at < now() - make_interval(mins => $2)`,
      [TEST_EMAIL_PATTERN, olderThanMinutes],
    );
  }
}

export class ProductRepository {
  constructor(private readonly db: DatabaseClient) {}

  findById(id: ProductId): Promise<ProductRow | undefined> {
    return this.db.maybeOne<ProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1`, [id]);
  }

  /** Catalogue products only - products created by tests are excluded. */
  listCatalogue(): Promise<ProductRow[]> {
    return this.db.query<ProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE sku NOT LIKE $1 ORDER BY id`, [
      `${TEST_PRODUCT_SKU_PREFIX}%`,
    ]);
  }

  insert(product: ProductData): Promise<ProductRow> {
    return this.db.one<ProductRow>(
      `INSERT INTO products (sku, name, description, category, price_cents, stock)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${PRODUCT_COLUMNS}`,
      [product.sku, product.name, product.description, product.category, product.priceCents, product.stock],
    );
  }

  /**
   * Removes a test product with everything that references it. Cart and order lines
   * have no ON DELETE CASCADE to products, so they go first, in one transaction.
   */
  deleteTestProduct(id: ProductId): Promise<void> {
    return this.db.transaction(async (tx) => {
      const sku = (await tx.one<{ sku: string }>('SELECT sku FROM products WHERE id = $1', [id])).sku;
      if (!sku.startsWith(TEST_PRODUCT_SKU_PREFIX)) throw new Error(`Refusing to delete non-test product ${sku}`);
      await tx.execute('DELETE FROM cart_items WHERE product_id = $1', [id]);
      await tx.execute('DELETE FROM order_items WHERE product_id = $1', [id]);
      await tx.execute('DELETE FROM products WHERE id = $1', [id]);
    });
  }

  async deleteStaleTestProducts(olderThanMinutes: number): Promise<number> {
    const stale = await this.db.query<{ id: ProductId }>(
      `SELECT id FROM products WHERE sku LIKE $1 AND created_at < now() - make_interval(mins => $2)`,
      [`${TEST_PRODUCT_SKU_PREFIX}%`, olderThanMinutes],
    );
    for (const { id } of stale) await this.deleteTestProduct(id);
    return stale.length;
  }

  /** Test set-up through SQL; restricted to test products so a test can never alter the shared catalogue. */
  async setTestProductStock(id: ProductId, stock: number): Promise<void> {
    const changed = await this.db.execute(`UPDATE products SET stock = $2 WHERE id = $1 AND sku LIKE $3`, [
      id,
      stock,
      `${TEST_PRODUCT_SKU_PREFIX}%`,
    ]);
    if (changed !== 1) throw new Error(`Product ${id} is not a test product`);
  }

  /** Raises (never lowers) catalogue stock so repeated runs don't sell the shop out. Returns rows changed. */
  ensureMinimumStock(minimum: number): Promise<number> {
    return this.db.execute(`UPDATE products SET stock = $1 WHERE stock < $1 AND sku NOT LIKE $2`, [
      minimum,
      `${TEST_PRODUCT_SKU_PREFIX}%`,
    ]);
  }
}

export class CartRepository {
  constructor(private readonly db: DatabaseClient) {}

  cartsOf(customerId: CustomerId): Promise<CartRow[]> {
    return this.db.query<CartRow>(
      `SELECT id, customer_id AS "customerId", status FROM carts WHERE customer_id = $1 ORDER BY id`,
      [customerId],
    );
  }

  itemsOf(cartId: CartId): Promise<CartItemRow[]> {
    return this.db.query<CartItemRow>(
      `SELECT product_id AS "productId", quantity, unit_price_cents AS "unitPriceCents"
         FROM cart_items WHERE cart_id = $1 ORDER BY product_id`,
      [cartId],
    );
  }
}

export class OrderRepository {
  constructor(private readonly db: DatabaseClient) {}

  findByNumber(orderNumber: OrderNumber | string): Promise<OrderRow | undefined> {
    return this.db.maybeOne<OrderRow>(
      `SELECT id, order_number AS "orderNumber", customer_id AS "customerId", status,
              subtotal_cents AS "subtotalCents", tax_cents AS "taxCents", total_cents AS "totalCents",
              shipping_name AS "shippingName", shipping_address AS "shippingAddress", shipping_city AS "shippingCity",
              shipping_postcode AS "shippingPostcode", shipping_country AS "shippingCountry", created_at AS "createdAt"
         FROM orders WHERE order_number = $1`,
      [String(orderNumber)],
    );
  }

  itemsOf(orderId: OrderId): Promise<OrderItemRow[]> {
    return this.db.query<OrderItemRow>(
      `SELECT product_id AS "productId", product_name AS "productName", quantity,
              unit_price_cents AS "unitPriceCents", line_total_cents AS "lineTotalCents"
         FROM order_items WHERE order_id = $1 ORDER BY product_id`,
      [orderId],
    );
  }
}

/** Row counts that reference a customer, across every table. Used to prove deletes cascade. */
export async function rowsReferencingCustomer(db: DatabaseClient, customerId: CustomerId) {
  return db.one<{ customers: number; carts: number; cartItems: number; orders: number; orderItems: number }>(
    `SELECT
       (SELECT count(*) FROM customers WHERE id = $1)::int AS customers,
       (SELECT count(*) FROM carts WHERE customer_id = $1)::int AS carts,
       (SELECT count(*) FROM cart_items ci JOIN carts c ON c.id = ci.cart_id WHERE c.customer_id = $1)::int AS "cartItems",
       (SELECT count(*) FROM orders WHERE customer_id = $1)::int AS orders,
       (SELECT count(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.customer_id = $1)::int AS "orderItems"`,
    [customerId],
  );
}

export class ShopLiteDatabase {
  readonly customers: CustomerRepository;
  readonly products: ProductRepository;
  readonly carts: CartRepository;
  readonly orders: OrderRepository;

  constructor(readonly client: DatabaseClient) {
    this.customers = new CustomerRepository(client);
    this.products = new ProductRepository(client);
    this.carts = new CartRepository(client);
    this.orders = new OrderRepository(client);
  }
}
