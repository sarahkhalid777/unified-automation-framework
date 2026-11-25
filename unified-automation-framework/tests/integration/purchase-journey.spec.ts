import { Schema } from '@framework/app/shoplite/api/schemas';
import { pickProduct } from '@framework/app/shoplite/catalogue';
import { anOrder } from '@framework/app/shoplite/data/order.builder';
import { snapshotFromApi, snapshotFromConfirmationPage, snapshotFromDatabase } from '@framework/app/shoplite/order-snapshot';
import { aCustomer } from '@framework/data/builders/customer.builder';
import { aShippingAddress } from '@framework/data/builders/shipping-address.builder';
import { expect, test } from '@framework/fixtures/web.fixtures';

test.describe('Purchase journey across API, UI and database', { tag: ['@integration', '@e2e'] }, () => {
  test('INT-E2E-001 a customer created through the API buys in the UI, and UI, API and database agree', { tag: '@smoke' }, async ({
    api,
    shopApi,
    db,
    cleanup,
    shopper,
    header,
    confirmationPage,
  }, testInfo) => {
    // Everything generated at run time; values flow from one layer to the next through this record.
    const credentials = aCustomer().build();
    const address = aShippingAddress().build();
    const quantity = 2;
    const journey: Record<string, unknown> = { email: credentials.email };

    const customer = await test.step('1. Create the customer through the API', async () => {
      const response = await api.customers.register(credentials);
      expect(response).toHaveStatus(201);
      cleanup.add('delete journey customer', async () =>
        shopApi.deleteCustomer(await shopApi.logIn(credentials.email, credentials.password)),
      );
      journey.customerId = response.body.id;
      return response.body;
    });

    await test.step('2. The customer exists in PostgreSQL', async () => {
      const row = await db.customers.findById(customer.id);
      expect(row).toMatchObject({ email: customer.email, firstName: credentials.firstName, lastName: credentials.lastName });
    });

    await test.step('3. Log in through the web UI with the API-created credentials', async () => {
      await shopper.logIn(credentials);
      await expect(header.greeting).toHaveText(`Hi, ${credentials.firstName}`);
    });

    const product = await pickProduct(shopApi);
    const searchTerm = product.name.split(' ')[0]!;
    journey.productId = product.id;

    await test.step(`4. Search for "${searchTerm}" and open "${product.name}"`, async () => {
      await shopper.searchAndOpen(searchTerm, product.name);
    });

    await test.step(`5. Add ${quantity} to the cart`, async () => {
      await shopper.addOpenProductToCart(quantity);
      await expect(header.cartCount).toHaveText(String(quantity));
    });

    const orderNumber = await test.step('6. Complete checkout', async () => {
      const number = await shopper.checkOut(address);
      journey.orderNumber = number.value;
      return number;
    });
    const fromUi = await snapshotFromConfirmationPage(confirmationPage);

    const fromApi = await test.step('7. Validate the order through the API', async () => {
      const session = await shopApi.logIn(credentials.email, credentials.password);
      const response = await api.as(session).orders.get(orderNumber);
      expect(response).toHaveStatus(200);
      expect(response).toMatchSchema(Schema.order);
      expect(response.body.customerId).toBe(customer.id);
      return snapshotFromApi(response.body);
    });

    const fromDb = await test.step('8. Validate the order in PostgreSQL', async () => {
      const row = await db.orders.findByNumber(orderNumber);
      expect(row, `order ${orderNumber.value} in the orders table`).toBeDefined();
      expect(row!.customerId).toBe(customer.id);
      return snapshotFromDatabase(row!, await db.orders.itemsOf(row!.id));
    });

    await test.step('9. UI, API and database hold the same order, with the expected amounts', () => {
      // What should have been charged, worked out independently of all three layers.
      const plan = anOrder().withProduct(product, quantity).shippingTo(address).build();
      const expected = {
        orderNumber: orderNumber.value,
        status: 'PLACED',
        lines: plan.lines.map((line) => ({ name: line.product.name, quantity: line.quantity, lineTotalCents: line.lineTotal.cents })),
        totalCents: plan.total.cents,
        shipTo: `${address.name}, ${address.address}, ${address.city} ${address.postcode.toUpperCase()}, ${address.country}`,
      };
      expect(fromUi, 'UI').toEqual(expected);
      expect(fromApi, 'API').toEqual(expected);
      expect(fromDb, 'database').toEqual(expected);
    });

    await testInfo.attach('journey.json', {
      body: JSON.stringify({ ...journey, ui: fromUi, api: fromApi, database: fromDb }, null, 2),
      contentType: 'application/json',
    });
  });
});
