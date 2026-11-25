import { Schema } from '@framework/app/shoplite/api/schemas';
import { pickProducts } from '@framework/app/shoplite/catalogue';
import { anOrder, type OrderPlan } from '@framework/app/shoplite/data/order.builder';
import type { OrderItem } from '@framework/app/shoplite/model';
import type { ShopLiteApi } from '@framework/app/shoplite/shoplite-api';
import { OrderNumber } from '@framework/app/shoplite/value-objects/order-number';
import { aCustomer } from '@framework/data/builders/customer.builder';
import { aShippingAddress } from '@framework/data/builders/shipping-address.builder';
import { expect, test } from '@framework/fixtures/api.fixtures';

// Two catalogue products, quantities 1 and 2.
const twoProductOrder = async (shopApi: ShopLiteApi): Promise<OrderPlan> =>
  anOrder().withProducts(await pickProducts(shopApi, 2)).build();

// Compare order lines on the fields both sides have, in a stable order.
const comparableLines = (items: readonly OrderItem[]) =>
  items
    .map(({ productId, name, quantity, unitPriceCents, lineTotalCents }) => ({ productId, name, quantity, unitPriceCents, lineTotalCents }))
    .sort((a, b) => a.productId - b.productId);

const expectedLines = (plan: OrderPlan) =>
  comparableLines(
    plan.lines.map(({ product, quantity, lineTotal }) => ({
      productId: product.id,
      name: product.name,
      quantity,
      unitPriceCents: product.priceCents,
      lineTotalCents: lineTotal.cents,
    })),
  );

test.describe('Orders API', { tag: ['@api', '@orders'] }, () => {
  test('API-ORDER-001 create an order from the cart', { tag: '@smoke' }, async ({ api, shopApi, customerAccount }) => {
    const { session } = customerAccount;
    // Padding and lower case check that the server trims and normalises the address.
    const plan = anOrder()
      .withProducts(await pickProducts(shopApi, 2))
      .shippingTo(aShippingAddress().withPostcode('sw1a 1aa').build())
      .build();
    const cart = await shopApi.fillCart(session, plan);
    const stockBefore = new Map(
      await Promise.all(plan.lines.map(async ({ product }) => [product.id, (await shopApi.getProduct(product.id)).stock] as const)),
    );

    const response = await api.as(session).orders.place({ ...plan.shipping, city: `  ${plan.shipping.city}  ` });

    expect(response).toHaveStatus(201);
    expect(response).toMatchSchema(Schema.order);
    const order = response.body;
    expect(response.header('location')).toBe(`/api/orders/${order.orderNumber}`);

    await test.step('Order header', () => {
      expect(order).toMatchObject({ customerId: session.customer.id, status: 'PLACED', currency: 'USD' });
      expect(order.shipping).toEqual({ ...plan.shipping, postcode: 'SW1A 1AA' });
      // The order number embeds the UTC date it was placed on.
      expect(OrderNumber.parse(order.orderNumber).placedOn).toBe(order.createdAt.slice(0, 10));
    });

    await test.step('Order lines and amounts match what was planned (catalogue price x quantity, 8% tax)', () => {
      expect(comparableLines(order.items)).toEqual(expectedLines(plan));
      expect(order.subtotalCents).toBe(plan.subtotal.cents);
      expect(order.taxCents).toBe(plan.tax.cents);
      expect(order.totalCents).toBe(plan.total.cents);
    });

    await test.step('The cart is checked out and a fresh empty cart takes its place', async () => {
      const after = (await api.as(session).cart.get()).body;
      expect(after.id).not.toBe(cart.id);
      expect(after.items).toEqual([]);
    });

    await test.step('Stock went down by at least the ordered quantity', async () => {
      // "At least": other workers may order the same product at the same time.
      for (const { product, quantity } of plan.lines) {
        const now = (await shopApi.getProduct(product.id)).stock;
        expect(now).toBeLessThanOrEqual(stockBefore.get(product.id)! - quantity);
      }
    });
  });

  test('API-ORDER-002 retrieve an order and the order history', async ({ api, shopApi, customerAccount }) => {
    const { session } = customerAccount;
    await shopApi.fillCart(session, await twoProductOrder(shopApi));
    const placed = await shopApi.placeOrder(session, aShippingAddress().build());

    const byNumber = await api.as(session).orders.get(placed.orderNumber);
    expect(byNumber).toHaveStatus(200);
    expect(byNumber).toMatchSchema(Schema.order);
    expect(byNumber.body).toEqual(placed);

    const history = await api.as(session).orders.list();
    expect(history).toHaveStatus(200);
    expect(history).toMatchSchema(Schema.orderList);
    expect(history.body).toEqual({
      total: 1,
      items: [{ orderNumber: placed.orderNumber, status: 'PLACED', totalCents: placed.totalCents, createdAt: placed.createdAt }],
    });
  });

  test('API-ORDER-003 invalid order submissions are rejected', async ({ api, shopApi, customerAccount }) => {
    const { session } = customerAccount;
    const ordersApi = api.as(session).orders;

    await test.step('Empty cart -> 422 EMPTY_CART', async () => {
      const response = await ordersApi.place(aShippingAddress().build());
      expect(response).toHaveStatus(422);
      expect(response).toMatchSchema(Schema.error);
      expect(response.error.code).toBe('EMPTY_CART');
    });

    await shopApi.fillCart(session, await twoProductOrder(shopApi));

    await test.step('Every invalid shipping field is reported, not just the first', async () => {
      const response = await ordersApi.place({ name: ' ', address: '', city: '', postcode: '#', country: '' });
      expect(response).toHaveStatus(400);
      expect(response).toMatchSchema(Schema.error);
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.details?.map((d) => d.field).sort()).toEqual(
        ['shipping.address', 'shipping.city', 'shipping.country', 'shipping.name', 'shipping.postcode'],
      );
    });

    await test.step('No token -> 401', async () => {
      const response = await api.orders.place(aShippingAddress().build());
      expect(response).toHaveStatus(401);
      expect(response.error.code).toBe('UNAUTHORIZED');
    });

    await test.step('Rejected submissions placed no order and kept the cart', async () => {
      expect((await ordersApi.list()).body.total).toBe(0);
      expect((await api.as(session).cart.get()).body.items).toHaveLength(2);
    });
  });

  test("API-ORDER-004 a customer cannot read another customer's order", async ({ api, shopApi, cleanup, customerAccount }) => {
    await shopApi.fillCart(customerAccount.session, await twoProductOrder(shopApi));
    const order = await shopApi.placeOrder(customerAccount.session, aShippingAddress().build());

    const intruder = aCustomer().build();
    await shopApi.registerCustomer(intruder);
    const intruderSession = await shopApi.logIn(intruder.email, intruder.password);
    cleanup.add('delete second customer', () => shopApi.deleteCustomer(intruderSession));

    const response = await api.as(intruderSession).orders.get(order.orderNumber);

    // 404 rather than 403, so order numbers belonging to others cannot be confirmed to exist.
    expect(response).toHaveStatus(404);
    expect(response.error.code).toBe('NOT_FOUND');
  });
});
