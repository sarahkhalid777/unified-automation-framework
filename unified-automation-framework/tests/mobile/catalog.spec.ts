import { expect } from '@wdio/globals';
import { PRODUCTS } from '../../src/app/mydemoapp/data/demo-users';
import { MyDemoApp } from '../../src/app/mydemoapp/my-demo-app';
import { getMobileConfig } from '../../src/mobile/mobile-config';

describe('Catalogue and product details', () => {
  // Created in a hook: the global browser only has its commands once the session exists.
  let app: MyDemoApp;
  before(() => {
    app = new MyDemoApp(browser, getMobileConfig());
  });

  beforeEach(async () => {
    await app.freshStart();
  });

  it('MOB-APP-001 the app launches on the product catalogue with an empty cart @smoke', async () => {
    expect(await app.catalog.isShown()).toBe(true);

    const items = await app.catalog.visibleItems();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.name).not.toBe('');
      expect(item.price.cents).toBeGreaterThan(0);
    }
    expect(await app.nav.cartCount()).toBe(0);
  });

  it('MOB-PROD-001 a product can be found in the catalogue by name', async () => {
    // The app has no search box: finding a product means scrolling the catalogue to it.
    const found = await app.catalog.findProduct(PRODUCTS.bikeLight);

    expect(found.name).toBe(PRODUCTS.bikeLight);
    expect(found.price.cents).toBeGreaterThan(0);
  });

  it('MOB-PROD-002 product details show the name and price listed in the catalogue', async () => {
    const listed = await app.catalog.findProduct(PRODUCTS.backpack);

    await app.catalog.openProduct(PRODUCTS.backpack);
    const details = await app.product.details();

    expect(details.name).toBe(listed.name);
    expect(details.price.equals(listed.price)).toBe(true);
    expect(await app.product.quantityShown()).toBe(1);
  });
});
