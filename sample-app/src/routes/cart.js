import { Router } from 'express';
import { pool } from '../db/pool.js';
import { ApiError, Validator, isPositiveInt, notFound, requireAuth } from '../http.js';

export const cartRouter = Router();
cartRouter.use(requireAuth);

async function findOpenCartId(customerId, db = pool) {
  const { rows } = await db.query(`SELECT id FROM carts WHERE customer_id = $1 AND status = 'OPEN'`, [customerId]);
  return rows[0] ? Number(rows[0].id) : undefined;
}

async function ensureOpenCart(customerId) {
  const existing = await findOpenCartId(customerId);
  if (existing) return { id: existing, created: false };
  const { rows } = await pool.query(
    `INSERT INTO carts (customer_id) VALUES ($1)
     ON CONFLICT (customer_id) WHERE status = 'OPEN' DO UPDATE SET updated_at = now()
     RETURNING id, (xmax = 0) AS created`,
    [customerId],
  );
  return { id: Number(rows[0].id), created: rows[0].created };
}

export async function loadCart(cartId, db = pool) {
  const cart = await db.query('SELECT id, status, customer_id FROM carts WHERE id = $1', [cartId]);
  const items = await db.query(
    `SELECT ci.product_id, p.sku, p.name, ci.quantity, ci.unit_price_cents
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id = $1 ORDER BY p.name`,
    [cartId],
  );
  const mapped = items.rows.map((row) => ({
    productId: Number(row.product_id),
    sku: row.sku,
    name: row.name,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    lineTotalCents: row.quantity * row.unit_price_cents,
  }));
  return {
    id: Number(cart.rows[0].id),
    customerId: Number(cart.rows[0].customer_id),
    status: cart.rows[0].status,
    items: mapped,
    itemCount: mapped.reduce((sum, item) => sum + item.quantity, 0),
    subtotalCents: mapped.reduce((sum, item) => sum + item.lineTotalCents, 0),
    currency: 'USD',
  };
}

async function assertStock(productId, quantity) {
  const { rows } = await pool.query('SELECT price_cents, stock FROM products WHERE id = $1', [productId]);
  if (!rows[0]) throw notFound('Product');
  if (rows[0].stock < quantity) {
    throw new ApiError(409, 'INSUFFICIENT_STOCK', `Only ${rows[0].stock} unit(s) available`);
  }
  return rows[0].price_cents;
}

cartRouter.get('/', async (req, res) => {
  const { id } = await ensureOpenCart(req.customer.id);
  res.json(await loadCart(id));
});

cartRouter.post('/', async (req, res) => {
  const { id, created } = await ensureOpenCart(req.customer.id);
  res.status(created ? 201 : 200).json(await loadCart(id));
});

cartRouter.post('/items', async (req, res) => {
  const { productId, quantity = 1 } = req.body ?? {};
  const v = new Validator();
  v.check(isPositiveInt(productId), 'productId', 'productId must be a positive integer');
  v.check(isPositiveInt(quantity) && quantity <= 99, 'quantity', 'quantity must be an integer between 1 and 99');
  v.throwIfInvalid();

  const { id } = await ensureOpenCart(req.customer.id);
  const existing = await pool.query('SELECT quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2', [id, productId]);
  const newQuantity = (existing.rows[0]?.quantity ?? 0) + quantity;
  const price = await assertStock(productId, newQuantity);
  await pool.query(
    `INSERT INTO cart_items (cart_id, product_id, quantity, unit_price_cents) VALUES ($1, $2, $3, $4)
     ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity, unit_price_cents = EXCLUDED.unit_price_cents`,
    [id, productId, newQuantity, price],
  );
  await pool.query('UPDATE carts SET updated_at = now() WHERE id = $1', [id]);
  res.status(201).json(await loadCart(id));
});

cartRouter.patch('/items/:productId', async (req, res) => {
  const productId = Number(req.params.productId);
  const { quantity } = req.body ?? {};
  const v = new Validator();
  v.check(isPositiveInt(productId), 'productId', 'productId must be a positive integer');
  v.check(isPositiveInt(quantity) && quantity <= 99, 'quantity', 'quantity must be an integer between 1 and 99');
  v.throwIfInvalid();

  const { id } = await ensureOpenCart(req.customer.id);
  await assertStock(productId, quantity);
  const { rowCount } = await pool.query('UPDATE cart_items SET quantity = $3 WHERE cart_id = $1 AND product_id = $2', [id, productId, quantity]);
  if (rowCount === 0) throw notFound('Cart item');
  res.json(await loadCart(id));
});

cartRouter.delete('/items/:productId', async (req, res) => {
  const { id } = await ensureOpenCart(req.customer.id);
  const { rowCount } = await pool.query('DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2', [id, Number(req.params.productId)]);
  if (rowCount === 0) throw notFound('Cart item');
  res.json(await loadCart(id));
});

cartRouter.delete('/', async (req, res) => {
  const { id } = await ensureOpenCart(req.customer.id);
  await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [id]);
  res.json(await loadCart(id));
});
