import crypto from 'node:crypto';
import { Router } from 'express';
import { pool, withTransaction } from '../db/pool.js';
import { ApiError, Validator, isNonEmptyString, notFound, requireAuth } from '../http.js';

export const TAX_RATE = 0.08;
const ORDER_NUMBER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

function generateOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Array.from(crypto.randomBytes(6), (byte) => ORDER_NUMBER_ALPHABET[byte % ORDER_NUMBER_ALPHABET.length]).join('');
  return `SL-${date}-${suffix}`;
}

async function loadOrder(where, params) {
  const { rows } = await pool.query(`SELECT * FROM orders WHERE ${where}`, params);
  const order = rows[0];
  if (!order) return undefined;
  const items = await pool.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY product_name', [order.id]);
  return {
    id: Number(order.id),
    orderNumber: order.order_number,
    customerId: Number(order.customer_id),
    status: order.status,
    items: items.rows.map((item) => ({
      productId: Number(item.product_id),
      name: item.product_name,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
      lineTotalCents: item.line_total_cents,
    })),
    subtotalCents: order.subtotal_cents,
    taxCents: order.tax_cents,
    totalCents: order.total_cents,
    currency: 'USD',
    shipping: {
      name: order.shipping_name,
      address: order.shipping_address,
      city: order.shipping_city,
      postcode: order.shipping_postcode,
      country: order.shipping_country,
    },
    createdAt: order.created_at.toISOString(),
  };
}

/** Checkout: converts the customer's open cart into an order inside a single transaction. */
ordersRouter.post('/', async (req, res) => {
  const shipping = req.body?.shipping ?? {};
  const v = new Validator();
  v.check(isNonEmptyString(shipping.name, 200), 'shipping.name', 'Recipient name is required');
  v.check(isNonEmptyString(shipping.address, 300), 'shipping.address', 'Street address is required');
  v.check(isNonEmptyString(shipping.city, 100), 'shipping.city', 'City is required');
  v.check(typeof shipping.postcode === 'string' && /^[A-Za-z0-9 -]{3,10}$/.test(shipping.postcode), 'shipping.postcode', 'Postcode must be 3-10 letters, digits, spaces or hyphens');
  v.check(isNonEmptyString(shipping.country, 60), 'shipping.country', 'Country is required');
  v.throwIfInvalid();

  const orderId = await withTransaction(async (db) => {
    const cart = await db.query(`SELECT id FROM carts WHERE customer_id = $1 AND status = 'OPEN' FOR UPDATE`, [req.customer.id]);
    const cartId = cart.rows[0]?.id;
    const items = cartId
      ? (await db.query(
          `SELECT ci.product_id, ci.quantity, p.name, p.price_cents, p.stock
             FROM cart_items ci JOIN products p ON p.id = ci.product_id
            WHERE ci.cart_id = $1 FOR UPDATE OF p`,
          [cartId],
        )).rows
      : [];
    if (items.length === 0) throw new ApiError(422, 'EMPTY_CART', 'Cannot place an order with an empty cart');

    const shortage = items.find((item) => item.stock < item.quantity);
    if (shortage) throw new ApiError(409, 'INSUFFICIENT_STOCK', `Insufficient stock for ${shortage.name}`);

    const subtotal = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
    const tax = Math.round(subtotal * TAX_RATE);
    const order = await db.query(
      `INSERT INTO orders (order_number, customer_id, subtotal_cents, tax_cents, total_cents,
                           shipping_name, shipping_address, shipping_city, shipping_postcode, shipping_country)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [generateOrderNumber(), req.customer.id, subtotal, tax, subtotal + tax,
        shipping.name.trim(), shipping.address.trim(), shipping.city.trim(), shipping.postcode.trim().toUpperCase(), shipping.country.trim()],
    );
    for (const item of items) {
      await db.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price_cents, line_total_cents)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.rows[0].id, item.product_id, item.name, item.quantity, item.price_cents, item.price_cents * item.quantity],
      );
      await db.query('UPDATE products SET stock = stock - $2 WHERE id = $1', [item.product_id, item.quantity]);
    }
    await db.query(`UPDATE carts SET status = 'CHECKED_OUT', updated_at = now() WHERE id = $1`, [cartId]);
    return order.rows[0].id;
  });

  const order = await loadOrder('id = $1', [orderId]);
  res.status(201).location(`/api/orders/${order.orderNumber}`).json(order);
});

ordersRouter.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT order_number, status, total_cents, created_at FROM orders WHERE customer_id = $1 ORDER BY created_at DESC',
    [req.customer.id],
  );
  res.json({
    items: rows.map((row) => ({ orderNumber: row.order_number, status: row.status, totalCents: row.total_cents, createdAt: row.created_at.toISOString() })),
    total: rows.length,
  });
});

ordersRouter.get('/:orderNumber', async (req, res) => {
  const order = await loadOrder('order_number = $1 AND customer_id = $2', [req.params.orderNumber, req.customer.id]);
  if (!order) throw notFound('Order');
  res.json(order);
});
