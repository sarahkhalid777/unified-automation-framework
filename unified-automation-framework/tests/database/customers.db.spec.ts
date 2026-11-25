import { rowsReferencingCustomer } from '@framework/app/shoplite/database/shoplite-database';
import { pickProducts } from '@framework/app/shoplite/catalogue';
import { aCustomer, uniqueEmail } from '@framework/data/builders/customer.builder';
import { aShippingAddress } from '@framework/data/builders/shipping-address.builder';
import { Email } from '@framework/data/value-objects/email';
import { expect, test } from '@framework/fixtures/api.fixtures';

const BCRYPT_COST_10 = /^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/;

test.describe('Customer data in PostgreSQL', { tag: ['@database', '@customers'] }, () => {
  test('DB-CUSTOMER-001 a customer registered through the API is stored correctly', { tag: '@smoke' }, async ({
    db,
    shopApi,
    cleanup,
  }) => {
    const data = aCustomer().withEmail(uniqueEmail().toUpperCase()).withPhone('+1 555 010 0100').build();
    const created = await shopApi.registerCustomer(data);
    cleanup.add('delete customer', async () => shopApi.deleteCustomer(await shopApi.logIn(data.email, data.password)));

    const row = await db.customers.findById(created.id);

    expect(row).toMatchObject({
      email: Email.of(data.email).value,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
    });
    expect(row!.createdAt.toISOString()).toBe(created.createdAt);

    await test.step('The password is stored only as a bcrypt hash', () => {
      expect(row!.passwordHash).toMatch(BCRYPT_COST_10);
      expect(row!.passwordHash).not.toContain(data.password);
    });

    await test.step('The email is stored normalised: the upper-case spelling sent is not what the column holds', async () => {
      const exact = await db.client.query('SELECT id FROM customers WHERE email = $1', [data.email]);
      expect(exact).toEqual([]);
      expect((await db.customers.findByEmail(Email.of(data.email)))?.id).toBe(created.id);
    });
  });

  test('DB-CUSTOMER-002 a profile update through the API is persisted', async ({ db, api, customerAccount }) => {
    const { session } = customerAccount;

    const response = await api.as(session).customers.update(session.customer.id, { lastName: 'Lovelace', phone: '+44 20 7946 0001' });
    expect(response).toHaveStatus(200);

    const row = await db.customers.findById(session.customer.id);
    expect(row).toMatchObject({ lastName: 'Lovelace', phone: '+44 20 7946 0001', firstName: session.customer.firstName });
    expect(row!.updatedAt.toISOString()).toBe(response.body.updatedAt);
    expect(row!.updatedAt.getTime()).toBeGreaterThan(row!.createdAt.getTime());
  });

  test('DB-CUSTOMER-003 deleting a customer removes their carts and orders', async ({ db, api, shopApi, cleanup }) => {
    const data = aCustomer().build();
    await shopApi.registerCustomer(data);
    const session = await shopApi.logIn(data.email, data.password);
    // Safety net if the test fails before its own delete; a 404 here just means the test already removed it.
    cleanup.add('delete customer', () => shopApi.deleteCustomer(session));
    const [first, second] = await pickProducts(shopApi, 2);

    // One completed order plus an open cart with an item in it.
    await shopApi.addToCart(session, first!.id, 1);
    await shopApi.placeOrder(session, aShippingAddress().build());
    await shopApi.addToCart(session, second!.id, 1);

    // A checked-out cart keeps its items as history, so there are two cart items: one per cart.
    expect(await rowsReferencingCustomer(db.client, session.customer.id)).toEqual({
      customers: 1,
      carts: 2,
      cartItems: 2,
      orders: 1,
      orderItems: 1,
    });

    expect(await api.as(session).customers.delete(session.customer.id)).toHaveStatus(204);

    expect(await rowsReferencingCustomer(db.client, session.customer.id)).toEqual({
      customers: 0,
      carts: 0,
      cartItems: 0,
      orders: 0,
      orderItems: 0,
    });
    // Products are shared reference data and must survive.
    expect(await db.products.findById(first!.id)).toBeDefined();
  });
});
