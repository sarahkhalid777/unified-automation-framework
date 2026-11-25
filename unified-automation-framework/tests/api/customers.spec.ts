import { Schema } from '@framework/app/shoplite/api/schemas';
import { aCustomer, uniqueEmail } from '@framework/data/builders/customer.builder';
import { Email } from '@framework/data/value-objects/email';
import { expect, test } from '@framework/fixtures/api.fixtures';

test.describe('Customers API', { tag: ['@api', '@customers'] }, () => {
  test('API-CUSTOMER-001 create a customer', { tag: '@smoke' }, async ({ api, shopApi, cleanup }) => {
    const data = aCustomer().withEmail(uniqueEmail().toUpperCase()).withPhone('+1 555 010 0199').build();

    const response = await api.customers.register(data);
    if (response.status === 201) {
      cleanup.add('delete registered customer', async () => shopApi.deleteCustomer(await shopApi.logIn(data.email, data.password)));
    }

    expect(response).toHaveStatus(201);
    expect(response).toMatchSchema(Schema.customer);
    const customer = response.body;
    expect(customer).toMatchObject({
      email: Email.of(data.email).value, // stored normalised
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
    });
    expect(customer.createdAt).toBe(customer.updatedAt);
    expect(response.header('location')).toBe(`/api/customers/${customer.id}`);

    await test.step('The new credentials can log in', async () => {
      const login = await api.auth.login({ email: data.email, password: data.password });
      expect(login).toHaveStatus(200);
      expect(login).toMatchSchema(Schema.authSession);
      expect(login.body.customer.id).toBe(customer.id);
    });
  });

  test('API-CUSTOMER-002 retrieve the logged-in customer', async ({ api, customerAccount }) => {
    const { session } = customerAccount;
    const asCustomer = api.as(session);

    const byId = await asCustomer.customers.get(session.customer.id);
    expect(byId).toHaveStatus(200);
    expect(byId).toMatchSchema(Schema.customer);
    expect(byId.body).toEqual(session.customer);

    const me = await asCustomer.auth.me();
    expect(me).toHaveStatus(200);
    expect(me.body).toEqual(byId.body);
  });

  test('API-CUSTOMER-003 update a customer with PUT and PATCH', async ({ api, customerAccount }) => {
    const { session } = customerAccount;
    const asCustomer = api.as(session);
    const id = session.customer.id;

    const replaced = await test.step('PUT replaces the whole profile', async () => {
      const response = await asCustomer.customers.replace(id, { firstName: 'Grace', lastName: 'Hopper', phone: '+44 20 7946 0000' });
      expect(response).toHaveStatus(200);
      expect(response).toMatchSchema(Schema.customer);
      expect(response.body).toMatchObject({ firstName: 'Grace', lastName: 'Hopper', phone: '+44 20 7946 0000', email: session.customer.email });
      expect(Date.parse(response.body.updatedAt)).toBeGreaterThan(Date.parse(session.customer.updatedAt));
      return response.body;
    });

    await test.step('PATCH changes only the fields sent', async () => {
      const response = await asCustomer.customers.update(id, { lastName: 'Hopper-Murray' });
      expect(response).toHaveStatus(200);
      expect(response.body).toMatchObject({ firstName: 'Grace', lastName: 'Hopper-Murray', phone: replaced.phone });
    });

    await test.step('PUT without a phone clears it - full replacement semantics', async () => {
      const response = await asCustomer.customers.replace(id, { firstName: 'Grace', lastName: 'Hopper' });
      expect(response).toHaveStatus(200);
      expect(response.body.phone).toBeNull();
    });

    await test.step('Email cannot be changed through the profile endpoint', async () => {
      const response = await asCustomer.customers.update(id, { email: uniqueEmail() });
      expect(response).toHaveStatus(400);
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect((await asCustomer.customers.get(id)).body.email).toBe(session.customer.email);
    });
  });

  const invalidRegistrations: Array<{ name: string; change: (data: Record<string, unknown>) => void; fields: string[] }> = [
    { name: 'missing first name', change: (d) => delete d.firstName, fields: ['firstName'] },
    { name: 'malformed email', change: (d) => (d.email = 'not-an-email'), fields: ['email'] },
    { name: 'password without a digit', change: (d) => (d.password = 'onlyletters'), fields: ['password'] },
    { name: 'password shorter than 8 characters', change: (d) => (d.password = 'ab1'), fields: ['password'] },
    { name: 'invalid phone number', change: (d) => (d.phone = 'call me'), fields: ['phone'] },
    {
      name: 'empty body',
      change: (d) => Object.keys(d).forEach((key) => delete d[key]),
      fields: ['firstName', 'lastName', 'email', 'password'],
    },
  ];

  for (const { name, change, fields } of invalidRegistrations) {
    test(`API-CUSTOMER-004 registration is rejected: ${name}`, async ({ api }) => {
      const data: Record<string, unknown> = { ...aCustomer().build() };
      change(data);

      const response = await api.customers.register(data);

      expect(response).toHaveStatus(400);
      expect(response).toMatchSchema(Schema.error);
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.details?.map((detail) => detail.field).sort()).toEqual([...fields].sort());
    });
  }

  test('API-CUSTOMER-005 registration is rejected for an email that is already registered', async ({ api, customerAccount }) => {
    // Different letter case: uniqueness must not be case-sensitive.
    const duplicate = aCustomer().withEmail(customerAccount.credentials.email.toUpperCase()).build();

    const response = await api.customers.register(duplicate);

    expect(response).toHaveStatus(409);
    expect(response).toMatchSchema(Schema.error);
    expect(response.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  test('API-CUSTOMER-006 customer records are protected', async ({ api, shopApi, cleanup, customerAccount }) => {
    const other = aCustomer().build();
    const otherCustomer = await shopApi.registerCustomer(other);
    cleanup.add('delete second customer', async () => shopApi.deleteCustomer(await shopApi.logIn(other.email, other.password)));
    const ownId = customerAccount.session.customer.id;

    const cases = [
      { name: 'no token', call: () => api.customers.get(ownId), status: 401, code: 'UNAUTHORIZED' },
      { name: 'forged token', call: () => api.as(`${customerAccount.session.token}x`).customers.get(ownId), status: 401, code: 'UNAUTHORIZED' },
      {
        name: "another customer's record",
        call: () => api.as(customerAccount.session).customers.get(otherCustomer.id),
        status: 403,
        code: 'FORBIDDEN',
      },
      {
        name: "deleting another customer's record",
        call: () => api.as(customerAccount.session).customers.delete(otherCustomer.id),
        status: 403,
        code: 'FORBIDDEN',
      },
    ];
    for (const { name, call, status, code } of cases) {
      await test.step(name, async () => {
        const response = await call();
        expect(response).toHaveStatus(status);
        expect(response.error.code).toBe(code);
      });
    }
  });

  test('API-CUSTOMER-007 delete a customer', async ({ api, shopApi, cleanup }) => {
    const data = aCustomer().build();
    await shopApi.registerCustomer(data);
    const session = await shopApi.logIn(data.email, data.password);
    // Safety net if the test fails before its own delete; a 404 here just means the test already removed it.
    cleanup.add('delete customer', () => shopApi.deleteCustomer(session));

    const response = await api.as(session).customers.delete(session.customer.id);
    expect(response).toHaveStatus(204);
    expect(response.body).toBeUndefined();

    // The token is still validly signed, but the record behind it is gone.
    expect(await api.as(session).customers.get(session.customer.id)).toHaveStatus(404);
    expect(await api.auth.login({ email: data.email, password: data.password })).toHaveStatus(401);
  });
});
