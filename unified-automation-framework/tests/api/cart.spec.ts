import { Schema } from '@framework/app/shoplite/api/schemas';
import { pickProducts } from '@framework/app/shoplite/catalogue';
import { nonExistentProductId } from '@framework/app/shoplite/ids';
import type { Cart } from '@framework/app/shoplite/model';
import { expect, test } from '@framework/fixtures/api.fixtures';

// Recomputes what the server should have calculated, so totals are checked, not just echoed.
function expectConsistentTotals(cart: Cart): void {
  for (const item of cart.items) expect(item.lineTotalCents).toBe(item.unitPriceCents * item.quantity);
  expect(cart.itemCount).toBe(cart.items.reduce((sum, item) => sum + item.quantity, 0));
  expect(cart.subtotalCents).toBe(cart.items.reduce((sum, item) => sum + item.lineTotalCents, 0));
}

test.describe('Cart API', { tag: ['@api', '@cart'] }, () => {
  test('API-CART-001 create a cart', { tag: '@smoke' }, async ({ api, customerAccount }) => {
    const cartApi = api.as(customerAccount.session).cart;

    const created = await cartApi.create();
    expect(created).toHaveStatus(201);
    expect(created).toMatchSchema(Schema.cart);
    expect(created.body).toMatchObject({
      customerId: customerAccount.session.customer.id,
      status: 'OPEN',
      items: [],
      itemCount: 0,
      subtotalCents: 0,
    });

    await test.step('Creating again returns the same open cart (one open cart per customer)', async () => {
      const again = await cartApi.create();
      expect(again).toHaveStatus(200);
      expect(again.body.id).toBe(created.body.id);
      expect((await cartApi.get()).body.id).toBe(created.body.id);
    });
  });

  test('API-CART-002 add, update and remove cart items', async ({ api, shopApi, customerAccount }) => {
    const [first, second] = await pickProducts(shopApi, 2, { minStock: 10 });
    const cartApi = api.as(customerAccount.session).cart;

    await test.step('Add two units of the first product', async () => {
      const response = await cartApi.addItem({ productId: first!.id, quantity: 2 });
      expect(response).toHaveStatus(201);
      expect(response).toMatchSchema(Schema.cart);
      expect(response.body.items).toEqual([
        expect.objectContaining({ productId: first!.id, sku: first!.sku, quantity: 2, unitPriceCents: first!.priceCents }),
      ]);
      expectConsistentTotals(response.body);
    });

    await test.step('Adding the same product again increases its quantity', async () => {
      const response = await cartApi.addItem({ productId: first!.id, quantity: 1 });
      expect(response.body.items.find((item) => item.productId === first!.id)?.quantity).toBe(3);
    });

    await test.step('Quantity defaults to 1 when not sent', async () => {
      const response = await cartApi.addItem({ productId: second!.id });
      expect(response).toHaveStatus(201);
      expect(response.body.items.find((item) => item.productId === second!.id)?.quantity).toBe(1);
      expect(response.body.itemCount).toBe(4);
      expectConsistentTotals(response.body);
    });

    await test.step('Set the quantity of the first product to 1', async () => {
      const response = await cartApi.updateItem(first!.id, 1);
      expect(response).toHaveStatus(200);
      expect(response.body.items.find((item) => item.productId === first!.id)?.quantity).toBe(1);
      expectConsistentTotals(response.body);
    });

    await test.step('Remove the second product', async () => {
      const response = await cartApi.removeItem(second!.id);
      expect(response).toHaveStatus(200);
      expect(response.body.items.map((item) => item.productId)).toEqual([first!.id]);
      expectConsistentTotals(response.body);
    });

    await test.step('Clear the cart', async () => {
      const response = await cartApi.clear();
      expect(response).toHaveStatus(200);
      expect(response.body).toMatchObject({ items: [], itemCount: 0, subtotalCents: 0 });
    });
  });

  test('API-CART-003 invalid cart operations are rejected', async ({ api, shopApi, customerAccount }) => {
    const { items } = await shopApi.listProducts();
    const product = items.find((p) => p.stock >= 1)!;
    const cartApi = api.as(customerAccount.session).cart;

    const cases = [
      { name: 'quantity 0', call: () => cartApi.addItem({ productId: product.id, quantity: 0 }), status: 400, code: 'VALIDATION_ERROR' },
      { name: 'quantity above 99', call: () => cartApi.addItem({ productId: product.id, quantity: 100 }), status: 400, code: 'VALIDATION_ERROR' },
      { name: 'unknown product', call: () => cartApi.addItem({ productId: nonExistentProductId, quantity: 1 }), status: 404, code: 'NOT_FOUND' },
      { name: 'updating an item not in the cart', call: () => cartApi.updateItem(product.id, 2), status: 404, code: 'NOT_FOUND' },
      { name: 'no token', call: () => api.cart.get(), status: 401, code: 'UNAUTHORIZED' },
    ];

    // Only testable when some product has fewer than 99 units left, since 99 is the per-request maximum.
    const scarce = items.find((p) => p.stock < 99);
    if (scarce) {
      cases.push({
        name: 'more than the available stock',
        call: () => cartApi.addItem({ productId: scarce.id, quantity: scarce.stock + 1 }),
        status: 409,
        code: 'INSUFFICIENT_STOCK',
      });
    }

    for (const { name, call, status, code } of cases) {
      await test.step(name, async () => {
        const response = await call();
        expect(response).toHaveStatus(status);
        expect(response).toMatchSchema(Schema.error);
        expect(response.error.code).toBe(code);
      });
    }

    await test.step('None of the rejected requests changed the cart', async () => {
      expect((await cartApi.get()).body.items).toEqual([]);
    });
  });
});
