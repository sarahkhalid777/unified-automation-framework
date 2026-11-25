import { Schema } from '@framework/app/shoplite/api/schemas';
import { pickProducts } from '@framework/app/shoplite/catalogue';
import type { Product } from '@framework/app/shoplite/model';
import { snapshotFromApi, snapshotFromConfirmationPage, snapshotFromDatabase } from '@framework/app/shoplite/order-snapshot';
import type { ShopperFlow } from '@framework/app/shoplite/flows/shopper.flow';
import type { OrderNumber } from '@framework/app/shoplite/value-objects/order-number';
import type { ProductDetailPage } from '@framework/app/shoplite/pages/product-detail.page';
import { aShippingAddress } from '@framework/data/builders/shipping-address.builder';
import { expect, signedInTest as test } from '@framework/fixtures/web.fixtures';

// Two products bought through the UI: quantities 1 and 2.
async function buyThroughUi(shopper: ShopperFlow, productPage: ProductDetailPage, products: Product[]): Promise<OrderNumber> {
  for (const [index, product] of products.entries()) {
    await productPage.openProduct(product.id);
    await shopper.addOpenProductToCart(index + 1);
  }
  return shopper.checkOut(aShippingAddress().build());
}

test.describe('Orders placed in the UI, checked in other layers', { tag: ['@integration', '@orders'] }, () => {
  test('INT-ORDER-001 an order placed through the UI is reported identically by the API', async ({
    api,
    shopApi,
    shopper,
    productPage,
    confirmationPage,
    customerAccount,
  }) => {
    const { session } = customerAccount;
    const orderNumber = await buyThroughUi(shopper, productPage, await pickProducts(shopApi, 2));
    const fromUi = await snapshotFromConfirmationPage(confirmationPage);

    const response = await api.as(session).orders.get(orderNumber);
    expect(response).toHaveStatus(200);
    expect(response).toMatchSchema(Schema.order);
    expect(snapshotFromApi(response.body)).toEqual(fromUi);

    const history = (await api.as(session).orders.list()).body;
    expect(history.items.map((o) => o.orderNumber)).toEqual([orderNumber.value]);
    expect((await api.as(session).cart.get()).body.items).toEqual([]);
  });

  test('INT-ORDER-002 an order placed through the UI is stored correctly in the database', async ({
    db,
    shopApi,
    shopper,
    productPage,
    confirmationPage,
    customerAccount,
  }) => {
    const products = await pickProducts(shopApi, 2);
    const stockBefore = await Promise.all(products.map(async (p) => (await db.products.findById(p.id))!.stock));

    const orderNumber = await buyThroughUi(shopper, productPage, products);
    const fromUi = await snapshotFromConfirmationPage(confirmationPage);

    const row = await db.orders.findByNumber(orderNumber);
    expect(row?.customerId).toBe(customerAccount.session.customer.id);
    expect(snapshotFromDatabase(row!, await db.orders.itemsOf(row!.id))).toEqual(fromUi);

    // The purchased cart is closed. The confirmation page's header asks for the cart count,
    // which makes the app open a fresh cart - that one must be empty.
    const carts = await db.carts.cartsOf(customerAccount.session.customer.id);
    expect(carts.filter((c) => c.status === 'CHECKED_OUT')).toHaveLength(1);
    for (const open of carts.filter((c) => c.status === 'OPEN')) {
      expect(await db.carts.itemsOf(open.id)).toEqual([]);
    }

    for (const [index, product] of products.entries()) {
      // "At most": other workers may buy the same product meanwhile.
      expect((await db.products.findById(product.id))!.stock).toBeLessThanOrEqual(stockBefore[index]! - (index + 1));
    }
  });
});
