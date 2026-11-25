import { SESSION_STORAGE_KEYS } from '../app/shoplite/business-rules';
import { ShopperFlow } from '../app/shoplite/flows/shopper.flow';
import { CartPage } from '../app/shoplite/pages/cart.page';
import { CheckoutPage } from '../app/shoplite/pages/checkout.page';
import { ConfirmationPage } from '../app/shoplite/pages/confirmation.page';
import { LoginPage } from '../app/shoplite/pages/login.page';
import { OrdersPage } from '../app/shoplite/pages/orders.page';
import { ProductDetailPage } from '../app/shoplite/pages/product-detail.page';
import { ProductsPage } from '../app/shoplite/pages/products.page';
import { SiteHeader } from '../app/shoplite/pages/site-header';
import { BrowserDiagnostics, summarise } from '../browser/browser-diagnostics';
import { getConfig } from '../config/framework-config';
import { expect, test as apiTest } from './api.fixtures';

interface WebFixtures {
  /** When true (default), an uncaught JavaScript error in the page fails the test. */
  failOnPageErrors: boolean;
  diagnostics: BrowserDiagnostics;
  header: SiteHeader;
  loginPage: LoginPage;
  productsPage: ProductsPage;
  productPage: ProductDetailPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  confirmationPage: ConfirmationPage;
  ordersPage: OrdersPage;
  /** Business-level UI steps (log in, search, add to cart, check out) composed from the page objects above. */
  shopper: ShopperFlow;
}

export const test = apiTest.extend<WebFixtures>({
  failOnPageErrors: [true, { option: true }],

  // Requests the page makes carry the test's request ID too, so UI-driven calls show up
  // in the application log under the same test ID as the API calls.
  extraHTTPHeaders: async ({ extraHTTPHeaders, traceId }, use) =>
    use({ ...extraHTTPHeaders, [getConfig().api.correlationHeader]: `${traceId}.ui` }),

  diagnostics: [
    async ({ context, failOnPageErrors }, use, testInfo) => {
      const diagnostics = new BrowserDiagnostics(context);
      await use(diagnostics);

      const events = await diagnostics.collect();
      if (events.length > 0 && testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('browser-diagnostics.json', {
          body: JSON.stringify(events, null, 2),
          contentType: 'application/json',
        });
      }
      if (failOnPageErrors) {
        const pageErrors = events.filter((event) => event.kind === 'page-error');
        expect(pageErrors, `Uncaught errors in the page:\n${summarise(pageErrors)}`).toEqual([]);
      }
    },
    { auto: true },
  ],

  header: async ({ page }, use) => use(new SiteHeader(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  productsPage: async ({ page }, use) => use(new ProductsPage(page)),
  productPage: async ({ page }, use) => use(new ProductDetailPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
  confirmationPage: async ({ page }, use) => use(new ConfirmationPage(page)),
  ordersPage: async ({ page }, use) => use(new OrdersPage(page)),
  shopper: async ({ loginPage, productsPage, productPage, cartPage, checkoutPage, confirmationPage }, use) =>
    use(
      new ShopperFlow({
        login: loginPage,
        products: productsPage,
        product: productPage,
        cart: cartPage,
        checkout: checkoutPage,
        confirmation: confirmationPage,
      }),
    ),
});

// Starts the test already logged in: the session the UI would store after login is
// put into localStorage before the page opens. Only the login tests go through the form.
export const signedInTest = test.extend({
  storageState: async ({ customerAccount, baseURL }, use) => {
    if (!baseURL) throw new Error('baseURL must be configured for signed-in tests');
    const { token, customer } = customerAccount.session;
    await use({
      cookies: [],
      origins: [
        {
          origin: new URL(baseURL).origin,
          localStorage: [
            { name: SESSION_STORAGE_KEYS.token, value: token },
            { name: SESSION_STORAGE_KEYS.customer, value: JSON.stringify(customer) },
          ],
        },
      ],
    });
  },
});

export { expect };
