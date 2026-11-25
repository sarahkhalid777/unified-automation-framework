import { TAX_RATE } from '@framework/app/shoplite/business-rules';
import { pickProducts } from '@framework/app/shoplite/catalogue';
import { aProduct } from '@framework/data/builders/product.builder';
import { aShippingAddress } from '@framework/data/builders/shipping-address.builder';
import { Money } from '@framework/data/value-objects/money';
import { expect, test } from '@framework/fixtures/api.fixtures';

test.describe('Order data in PostgreSQL', { tag: ['@database', '@orders'] }, () => {
  test('DB-ORDER-001 an order placed through the API is stored completely and consistently', { tag: '@smoke' }, async ({
    db,
    shopApi,
    customerAccount,
  }) => {
    const { session } = customerAccount;
    const [first, second] = await pickProducts(shopApi, 2);
    await shopApi.addToCart(session, first!.id, 2);
    const cart = await shopApi.addToCart(session, second!.id, 1);
    const stockBefore = new Map([
      [first!.id, (await db.products.findById(first!.id))!.stock],
      [second!.id, (await db.products.findById(second!.id))!.stock],
    ]);
    const shipping = aShippingAddress().build();

    const order = await shopApi.placeOrder(session, shipping);

    const row = await db.orders.findByNumber(order.orderNumber);
    const items = await db.orders.itemsOf(row!.id);

    await test.step('Order row matches the API response', () => {
      expect(row).toMatchObject({
        id: order.id,
        customerId: session.customer.id,
        status: 'PLACED',
        subtotalCents: order.subtotalCents,
        taxCents: order.taxCents,
        totalCents: order.totalCents,
        shippingName: shipping.name,
        shippingAddress: shipping.address,
        shippingCity: shipping.city,
        shippingPostcode: shipping.postcode.toUpperCase(),
        shippingCountry: shipping.country,
      });
      expect(row!.createdAt.toISOString()).toBe(order.createdAt);
    });

    await test.step('Stored amounts add up', () => {
      for (const item of items) expect(item.lineTotalCents).toBe(item.unitPriceCents * item.quantity);
      const subtotal = Money.sum(items.map((item) => Money.ofCents(item.lineTotalCents)));
      expect(row!.subtotalCents).toBe(subtotal.cents);
      expect(row!.taxCents).toBe(subtotal.percent(TAX_RATE).cents);
      expect(row!.totalCents).toBe(row!.subtotalCents + row!.taxCents);
    });

    await test.step('Order lines copy the cart, including product names at the time of sale', () => {
      expect(items).toEqual(
        cart.items
          .map((i) => ({ productId: i.productId, productName: i.name, quantity: i.quantity, unitPriceCents: i.unitPriceCents, lineTotalCents: i.lineTotalCents }))
          .sort((a, b) => a.productId - b.productId),
      );
    });

    await test.step('The cart is marked checked out and stock is reduced', async () => {
      expect((await db.carts.cartsOf(session.customer.id)).find((c) => c.id === cart.id)?.status).toBe('CHECKED_OUT');
      for (const item of cart.items) {
        // "At most": other workers may be buying the same product.
        expect((await db.products.findById(item.productId))!.stock).toBeLessThanOrEqual(stockBefore.get(item.productId)! - item.quantity);
      }
    });
  });

  test('DB-ORDER-002 a checkout that fails on stock leaves no partial data behind', async ({
    db,
    api,
    shopApi,
    cleanup,
    customerAccount,
  }) => {
    const { session } = customerAccount;
    // Test-only products, so no other worker changes their stock and it can be compared exactly.
    const plentiful = await db.products.insert(aProduct().withStock(10).build());
    const scarce = await db.products.insert(aProduct().withStock(5).build());
    for (const product of [plentiful, scarce]) {
      cleanup.add(`delete test product ${product.sku}`, () => db.products.deleteTestProduct(product.id));
    }

    await shopApi.addToCart(session, plentiful.id, 1);
    const cart = await shopApi.addToCart(session, scarce.id, 3);

    // Someone else buys the scarce product between "add to cart" and "checkout" - simulated directly in SQL.
    await db.products.setTestProductStock(scarce.id, 1);

    const response = await api.as(session).orders.place(aShippingAddress().build());
    expect(response).toHaveStatus(409);
    expect(response.error.code).toBe('INSUFFICIENT_STOCK');

    // The checkout transaction must roll back as a whole.
    expect(await db.client.query('SELECT id FROM orders WHERE customer_id = $1', [session.customer.id])).toEqual([]);
    expect(await db.carts.cartsOf(session.customer.id)).toEqual([{ id: cart.id, customerId: session.customer.id, status: 'OPEN' }]);
    expect(await db.carts.itemsOf(cart.id)).toHaveLength(2);
    expect((await db.products.findById(scarce.id))!.stock).toBe(1);
    // A partial checkout would already have taken stock from the product that was available.
    expect((await db.products.findById(plentiful.id))!.stock).toBe(10);
  });
});
