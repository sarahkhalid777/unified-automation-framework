import { MESSAGES } from '@framework/app/shoplite/business-rules';
import { pickProducts } from '@framework/app/shoplite/catalogue';
import { anOrder, type OrderLine, type OrderPlan } from '@framework/app/shoplite/data/order.builder';
import type { AuthSession } from '@framework/app/shoplite/model';
import type { ShopLiteApi } from '@framework/app/shoplite/shoplite-api';
import { OrderNumber } from '@framework/app/shoplite/value-objects/order-number';
import { aShippingAddress } from '@framework/data/builders/shipping-address.builder';
import { expect, signedInTest as test } from '@framework/fixtures/web.fixtures';
import type { Locator } from '@playwright/test';

// Two products, quantities 1 and 2, added through the API - the cart UI has its own tests.
async function cartReadyForCheckout(api: ShopLiteApi, session: AuthSession): Promise<OrderPlan> {
  const plan = anOrder().withProducts(await pickProducts(api, 2)).build();
  await api.fillCart(session, plan);
  return plan;
}

const lineText = (line: OrderLine) => `${line.quantity} x ${line.product.name} - ${line.lineTotal.format()}`;

// Line order on the page follows the database collation, so compare as sets.
async function expectLines(locator: Locator, lines: readonly OrderLine[]): Promise<void> {
  await expect(locator).toHaveCount(lines.length);
  expect((await locator.allTextContents()).sort()).toEqual(lines.map(lineText).sort());
}

test.describe('Checkout', { tag: ['@web', '@checkout'] }, () => {
  test('WEB-CHK-001 checkout with valid shipping details places the order', { tag: '@smoke' }, async ({
    page,
    checkoutPage,
    confirmationPage,
    shopApi,
    customerAccount,
  }) => {
    const plan = await cartReadyForCheckout(shopApi, customerAccount.session);

    await test.step('Order summary shows the cart lines, 8% tax and total', async () => {
      await checkoutPage.open();
      await expectLines(checkoutPage.summaryLines, plan.lines);
      await expect(checkoutPage.subtotal).toHaveText(plan.subtotal.format());
      await expect(checkoutPage.tax).toHaveText(plan.tax.format());
      await expect(checkoutPage.total).toHaveText(plan.total.format());
    });

    await test.step('Submit valid shipping details', async () => {
      await checkoutPage.fillShipping(plan.shipping);
      await checkoutPage.placeOrder();
    });

    await test.step('Customer is sent to the confirmation page and the cart is emptied', async () => {
      await expect(page).toHaveURL(
        (url) => url.pathname === '/confirmation' && OrderNumber.isValid(url.searchParams.get('order') ?? ''),
      );
      await expect(confirmationPage.panel).toBeVisible();
      await expect(confirmationPage.header.cartCount).toHaveText('0');
      expect((await shopApi.getCart(customerAccount.session)).items).toEqual([]);
    });
  });

  test('WEB-CHK-002 order confirmation shows the placed order', async ({
    page,
    checkoutPage,
    confirmationPage,
    ordersPage,
    shopApi,
    customerAccount,
  }) => {
    const plan = await cartReadyForCheckout(shopApi, customerAccount.session);

    await checkoutPage.open();
    await checkoutPage.fillShipping(plan.shipping);
    await checkoutPage.placeOrder();
    await expect(page).toHaveURL((url) => url.pathname === '/confirmation');
    const orderNumber = confirmationPage.orderNumberFromUrl();

    await test.step('Confirmation lists order number, status, items, total and shipping address', async () => {
      await expect(confirmationPage.orderNumber).toHaveText(orderNumber.value);
      await expect(confirmationPage.status).toHaveText('PLACED');
      await expectLines(confirmationPage.items, plan.lines);
      await expect(confirmationPage.total).toHaveText(plan.total.format());
      // The API stores postcodes upper-cased.
      await expect(confirmationPage.shipping).toHaveText(
        `${plan.shipping.name}, ${plan.shipping.address}, ${plan.shipping.city} ${plan.shipping.postcode.toUpperCase()}, ${plan.shipping.country}`,
      );
    });

    await test.step('The order appears in the order history', async () => {
      await ordersPage.open();
      const row = ordersPage.row(orderNumber.value);
      await expect(row).toHaveCount(1);
      await expect(row).toContainText('PLACED');
      await expect(row).toContainText(plan.total.format());
    });
  });

  test('WEB-CHK-003 checkout is blocked when shipping details are invalid', async ({
    page,
    checkoutPage,
    shopApi,
    customerAccount,
  }) => {
    const plan = await cartReadyForCheckout(shopApi, customerAccount.session);

    await checkoutPage.open();
    await expect(checkoutPage.total).toHaveText(plan.total.format());
    await checkoutPage.fillShipping(aShippingAddress().withName('').withPostcode('!!').build());
    await checkoutPage.placeOrder();

    await expect(checkoutPage.error).toHaveText(MESSAGES.validationFailed);
    await expect(checkoutPage.fieldError('name')).toHaveText('Recipient name is required');
    await expect(checkoutPage.fieldError('postcode')).toHaveText('Postcode must be 3-10 letters, digits, spaces or hyphens');
    await expect(checkoutPage.fieldError('city')).toBeEmpty();
    await expect(checkoutPage.placeOrderButton).toBeEnabled();
    await expect(page).toHaveURL((url) => url.pathname === '/checkout');

    const serverCart = await shopApi.getCart(customerAccount.session);
    expect(serverCart.items).toHaveLength(plan.lines.length);
  });
});
