import { MESSAGES } from '@framework/app/shoplite/business-rules';
import { aCustomer } from '@framework/data/builders/customer.builder';
import { expect, test } from '@framework/fixtures/web.fixtures';

test.describe('Customer lifecycle across layers', { tag: ['@integration', '@customers'] }, () => {
  test('INT-CUSTOMER-001 a customer created through the API logs in through the UI, and loses access once deleted', async ({
    page,
    api,
    shopApi,
    db,
    cleanup,
    shopper,
    loginPage,
    header,
  }) => {
    const credentials = aCustomer().build();
    const customer = await shopApi.registerCustomer(credentials);
    const session = await shopApi.logIn(credentials.email, credentials.password);
    cleanup.add('delete customer', () => shopApi.deleteCustomer(session));

    await test.step('The API-created customer is in the database', async () => {
      expect((await db.customers.findById(customer.id))?.email).toBe(customer.email);
    });

    await test.step('They can log in through the UI', async () => {
      await shopper.logIn(credentials);
      await expect(header.greeting).toHaveText(`Hi, ${credentials.firstName}`);
      await header.logOut();
      await expect(loginPage.notice).toHaveText(MESSAGES.loggedOut);
    });

    await test.step('After deletion through the API, the row is gone and UI login fails', async () => {
      expect(await api.as(session).customers.delete(customer.id)).toHaveStatus(204);
      expect(await db.customers.findById(customer.id)).toBeUndefined();

      await loginPage.open();
      await loginPage.logIn(credentials);
      await expect(loginPage.error).toHaveText(MESSAGES.invalidCredentials);
      await expect(page).toHaveURL((url) => url.pathname === '/login');
    });
  });
});
