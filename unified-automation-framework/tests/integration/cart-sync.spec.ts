import { pickProduct } from '@framework/app/shoplite/catalogue';
import { expect, signedInTest as test } from '@framework/fixtures/web.fixtures';

test.describe('Cart kept in step across layers', { tag: ['@integration', '@cart'] }, () => {
  test('INT-CART-001 cart changes made in one layer are visible in the others', async ({
    api,
    shopApi,
    db,
    cartPage,
    customerAccount,
  }) => {
    const { session } = customerAccount;
    const product = await pickProduct(shopApi);
    const cart = await shopApi.addToCart(session, product.id, 1);

    await test.step('Item added through the API appears in the UI cart', async () => {
      await cartPage.open();
      await expect(cartPage.rows).toHaveCount(1);
      await expect(cartPage.row(product.name).quantity).toHaveValue('1');
    });

    await test.step('Quantity changed in the UI is seen by the API and stored in the database', async () => {
      await cartPage.row(product.name).changeQuantity(3);
      await expect(cartPage.message).toHaveText(`Updated ${product.name}.`);

      expect((await api.as(session).cart.get()).body.items).toEqual([expect.objectContaining({ productId: product.id, quantity: 3 })]);
      expect(await db.carts.itemsOf(cart.id)).toEqual([{ productId: product.id, quantity: 3, unitPriceCents: product.priceCents }]);
    });

    await test.step('Item removed in the UI is gone from the API and the database', async () => {
      await cartPage.row(product.name).remove();
      await expect(cartPage.emptyState).toBeVisible();

      expect((await api.as(session).cart.get()).body.items).toEqual([]);
      expect(await db.carts.itemsOf(cart.id)).toEqual([]);
    });
  });
});
