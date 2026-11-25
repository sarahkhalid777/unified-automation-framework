import { pickProducts } from '@framework/app/shoplite/catalogue';
import { expect, test } from '@framework/fixtures/api.fixtures';
import type { DatabaseError } from 'pg';

test.describe('Cart data in PostgreSQL', { tag: ['@database', '@cart'] }, () => {
  test('DB-CART-001 cart contents from the API are persisted with a price snapshot', { tag: '@smoke' }, async ({
    db,
    shopApi,
    customerAccount,
  }) => {
    const { session } = customerAccount;
    const [first, second] = await pickProducts(shopApi, 2);
    await shopApi.addToCart(session, first!.id, 2);
    const cart = await shopApi.addToCart(session, second!.id, 1);

    const carts = await db.carts.cartsOf(session.customer.id);
    expect(carts).toEqual([{ id: cart.id, customerId: session.customer.id, status: 'OPEN' }]);

    const items = await db.carts.itemsOf(cart.id);
    expect(items).toEqual(
      [
        { productId: first!.id, quantity: 2, unitPriceCents: first!.priceCents },
        { productId: second!.id, quantity: 1, unitPriceCents: second!.priceCents },
      ].sort((a, b) => a.productId - b.productId),
    );
    // What the API reported matches what was stored.
    for (const item of cart.items) {
      expect(items).toContainEqual({ productId: item.productId, quantity: item.quantity, unitPriceCents: item.unitPriceCents });
    }
  });

  test('DB-CART-002 the database allows only one open cart per customer', async ({ db, api, customerAccount }) => {
    const { session } = customerAccount;
    expect(await api.as(session).cart.create()).toHaveStatus(201);

    const error = await db.client
      .withRollback((tx) => tx.execute(`INSERT INTO carts (customer_id, status) VALUES ($1, 'OPEN')`, [session.customer.id]))
      .catch((e: unknown) => e);

    expect((error as DatabaseError).code).toBe('23505');
    expect((error as DatabaseError).constraint).toBe('carts_one_open_per_customer');
    expect(await db.carts.cartsOf(session.customer.id)).toHaveLength(1);
  });
});
