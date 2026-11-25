import { pickProduct, pickProducts } from '@framework/app/shoplite/catalogue';
import { Money } from '@framework/data/value-objects/money';
import { expect, signedInTest as test } from '@framework/fixtures/web.fixtures';

test.describe('Shopping cart', { tag: ['@web', '@cart'] }, () => {
  test('WEB-CART-001 add a product to the cart from its detail page', { tag: '@smoke' }, async ({
    productPage,
    cartPage,
    shopApi,
    customerAccount,
  }) => {
    const product = await pickProduct(shopApi);
    const price = Money.ofCents(product.priceCents);
    const quantity = 2;

    await test.step(`Add ${quantity} x "${product.name}"`, async () => {
      await productPage.openProduct(product.id);
      await productPage.addToCart(quantity);
      await expect(productPage.message).toHaveText(`Added ${quantity} to cart.`);
      await expect(productPage.header.cartCount).toHaveText(String(quantity));
    });

    await test.step('Cart page shows the line with correct totals', async () => {
      await cartPage.open();
      const row = cartPage.row(product.name);
      await expect(cartPage.rows).toHaveCount(1);
      await expect(row.quantity).toHaveValue(String(quantity));
      await expect(row.unitPrice).toHaveText(price.format());
      await expect(row.lineTotal).toHaveText(price.times(quantity).format());
      await expect(cartPage.subtotal).toHaveText(price.times(quantity).format());
    });

    await test.step('The server-side cart holds the same item', async () => {
      const cart = await shopApi.getCart(customerAccount.session);
      expect(cart.items).toEqual([expect.objectContaining({ productId: product.id, quantity })]);
    });
  });

  test('WEB-CART-002 update the quantity of a cart item', async ({ cartPage, shopApi, customerAccount }) => {
    const product = await pickProduct(shopApi);
    const price = Money.ofCents(product.priceCents);
    await shopApi.addToCart(customerAccount.session, product.id, 1);

    await cartPage.open();
    const row = cartPage.row(product.name);
    await expect(row.quantity).toHaveValue('1');
    await row.changeQuantity(3);

    await expect(cartPage.message).toHaveText(`Updated ${product.name}.`);
    await expect(row.quantity).toHaveValue('3');
    await expect(row.lineTotal).toHaveText(price.times(3).format());
    await expect(cartPage.subtotal).toHaveText(price.times(3).format());
    await expect(cartPage.header.cartCount).toHaveText('3');
  });

  test('WEB-CART-003 remove products until the cart is empty', async ({ cartPage, shopApi, customerAccount }) => {
    const [first, second] = await pickProducts(shopApi, 2);
    await shopApi.addToCart(customerAccount.session, first!.id, 1);
    await shopApi.addToCart(customerAccount.session, second!.id, 1);

    await cartPage.open();
    await expect(cartPage.rows).toHaveCount(2);

    await test.step(`Remove "${first!.name}"`, async () => {
      await cartPage.row(first!.name).remove();
      await expect(cartPage.message).toHaveText(`Removed ${first!.name}.`);
      await expect(cartPage.rows).toHaveCount(1);
      await expect(cartPage.row(second!.name).root).toBeVisible();
      await expect(cartPage.subtotal).toHaveText(Money.ofCents(second!.priceCents).format());
      await expect(cartPage.header.cartCount).toHaveText('1');
    });

    await test.step(`Remove "${second!.name}", the last item`, async () => {
      await cartPage.row(second!.name).remove();
      await expect(cartPage.emptyState).toBeVisible();
      await expect(cartPage.rows).toHaveCount(0);
      await expect(cartPage.header.cartCount).toHaveText('0');
    });
  });
});
