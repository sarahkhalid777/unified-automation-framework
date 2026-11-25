import { expect } from '@wdio/globals';
import { PRODUCTS } from '../../src/app/mydemoapp/data/demo-users';
import { MyDemoApp } from '../../src/app/mydemoapp/my-demo-app';
import { Money } from '../../src/data/value-objects/money';
import { getMobileConfig } from '../../src/mobile/mobile-config';

describe('Cart', () => {
  // Created in a hook: the global browser only has its commands once the session exists.
  let app: MyDemoApp;
  before(() => {
    app = new MyDemoApp(browser, getMobileConfig());
  });

  beforeEach(async () => {
    await app.freshStart();
  });

  it('MOB-CART-001 adding a product updates the cart badge with the quantity @smoke', async () => {
    await app.catalog.openProduct(PRODUCTS.backpack);
    await app.product.addToCart(2);

    await app.nav.waitForCartCount(2);
  });

  it('MOB-CART-002 the cart lists each product with its quantity and the correct total', async () => {
    // Prices are read from the details screen, so the expected total doesn't depend on hard-coded prices.
    await app.catalog.openProduct(PRODUCTS.backpack);
    const backpack = await app.product.details();
    await app.product.addToCart(2);
    await app.nav.waitForCartCount(2);

    await app.nav.openCatalog();
    await app.catalog.openProduct(PRODUCTS.backpackOrange);
    const orange = await app.product.details();
    await app.product.addToCart(1);
    await app.nav.waitForCartCount(3);

    await app.nav.openCart();
    expect(await app.cart.line(backpack.name)).toEqual({ name: backpack.name, unitPrice: backpack.price, quantity: 2 });
    expect(await app.cart.line(orange.name)).toEqual({ name: orange.name, unitPrice: orange.price, quantity: 1 });

    // The item count and total also prove there are no other lines in the cart.
    const summary = await app.cart.summary();
    expect(summary.items).toBe(3);
    expect(summary.total.equals(Money.sum([backpack.price.times(2), orange.price]))).toBe(true);
  });
});
