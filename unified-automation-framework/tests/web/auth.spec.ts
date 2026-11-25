import { MESSAGES, SESSION_STORAGE_KEYS } from '@framework/app/shoplite/business-rules';
import { uniqueEmail, validPassword } from '@framework/data/builders/customer.builder';
import { expect, signedInTest, test } from '@framework/fixtures/web.fixtures';
import type { Page } from '@playwright/test';

const storedToken = (page: Page) => page.evaluate((key) => localStorage.getItem(key), SESSION_STORAGE_KEYS.token);

test.describe('Authentication', { tag: ['@web', '@auth'] }, () => {
  test('WEB-AUTH-001 registered customer logs in with valid credentials', { tag: '@smoke' }, async ({
    page,
    loginPage,
    customerAccount,
  }) => {
    const { credentials } = customerAccount;

    await test.step('Log in through the login form', async () => {
      await loginPage.open();
      await loginPage.logIn(credentials);
    });

    await test.step('Customer lands on the catalogue, greeted by first name', async () => {
      await expect(page).toHaveURL((url) => url.pathname === '/');
      await expect(loginPage.header.greeting).toHaveText(`Hi, ${credentials.firstName}`);
      await expect(loginPage.header.logoutButton).toBeVisible();
      await expect(loginPage.header.loginLink).toBeHidden();
    });
  });

  test('WEB-AUTH-002 login is rejected for a wrong password', async ({ page, loginPage, customerAccount }) => {
    await loginPage.open();
    await loginPage.logIn({ email: customerAccount.credentials.email, password: `${customerAccount.credentials.password}x` });

    await expect(loginPage.error).toHaveText(MESSAGES.invalidCredentials);
    await expect(page).toHaveURL((url) => url.pathname === '/login');
    await expect(loginPage.header.greeting).toBeHidden();
    expect(await storedToken(page)).toBeNull();
  });

  test('WEB-AUTH-003 login is rejected for an unregistered email', async ({ page, loginPage }) => {
    await loginPage.open();
    await loginPage.logIn({ email: uniqueEmail('unregistered'), password: validPassword() });

    // Same message as a wrong password, so the form does not reveal which emails are registered.
    await expect(loginPage.error).toHaveText(MESSAGES.invalidCredentials);
    await expect(page).toHaveURL((url) => url.pathname === '/login');
    expect(await storedToken(page)).toBeNull();
  });
});

signedInTest.describe('Logout', { tag: ['@web', '@auth'] }, () => {
  signedInTest('WEB-AUTH-004 logged-in customer logs out and loses access to the cart', async ({
    page,
    productsPage,
    loginPage,
    cartPage,
    customerAccount,
  }) => {
    await productsPage.open();
    await expect(productsPage.header.greeting).toHaveText(`Hi, ${customerAccount.credentials.firstName}`);

    await test.step('Log out from the header', async () => {
      await productsPage.header.logOut();
      await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.has('loggedOut'));
      await expect(loginPage.notice).toHaveText(MESSAGES.loggedOut);
      await expect(loginPage.header.loginLink).toBeVisible();
      expect(await storedToken(page)).toBeNull();
    });

    await test.step('Protected pages now redirect to login', async () => {
      await cartPage.open({}, { waitUntilReady: false });
      await expect(page).toHaveURL((url) => url.pathname === '/login' && url.searchParams.get('returnTo') === '/cart');
    });
  });
});
