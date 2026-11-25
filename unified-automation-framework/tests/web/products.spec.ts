import { faker } from '@faker-js/faker';
import { pickProduct } from '@framework/app/shoplite/catalogue';
import { Money } from '@framework/data/value-objects/money';
import { expect, test } from '@framework/fixtures/web.fixtures';

const resultSummary = (count: number, term: string) => `${count} result${count === 1 ? '' : 's'} for "${term}"`;

test.describe('Product catalogue', { tag: ['@web', '@catalogue'] }, () => {
  test('WEB-PROD-001 search returns the matching products', { tag: '@smoke' }, async ({ page, productsPage, shopApi }) => {
    const product = await pickProduct(shopApi, { minStock: 0 });
    // First word of a real product name, lower-cased: also checks the search is case-insensitive.
    const term = product.name.split(' ')[0]!.toLowerCase();
    const expected = await shopApi.listProducts(term);

    await productsPage.open();
    await productsPage.search(term);

    await expect(productsPage.resultSummary).toHaveText(resultSummary(expected.total, term));
    await expect(productsPage.productCards.getByTestId('product-link')).toHaveText(expected.items.map((p) => p.name));
    await expect(productsPage.productCard(product.name)).toBeVisible();
    await expect(page).toHaveURL((url) => url.searchParams.get('search') === term);
  });

  test('WEB-PROD-002 search with no matches shows an empty result', async ({ productsPage }) => {
    const term = `no-such-product-${faker.string.alphanumeric(8)}`;

    await productsPage.open();
    await productsPage.search(term);

    await expect(productsPage.resultSummary).toHaveText(resultSummary(0, term));
    await expect(productsPage.productCards).toHaveCount(0);
  });

  test('WEB-PROD-003 product details match the catalogue data', async ({ page, productsPage, productPage, shopApi }) => {
    const product = await pickProduct(shopApi, { minStock: 0 });

    await productsPage.open();
    await expect(productsPage.productCard(product.name).getByTestId('product-price')).toHaveText(
      Money.ofCents(product.priceCents).format(),
    );
    await productsPage.openProduct(product.name);

    await expect(page).toHaveURL((url) => url.pathname === '/product' && url.searchParams.get('id') === String(product.id));
    await expect(productPage.name).toHaveText(product.name);
    await expect(productPage.sku).toHaveText(product.sku);
    await expect(productPage.category).toHaveText(product.category);
    await expect(productPage.description).toHaveText(product.description);
    await expect(productPage.price).toHaveText(Money.ofCents(product.priceCents).format());
    await expect(page).toHaveTitle(`${product.name} | ShopLite`);

    // Checkout tests in other workers can reduce stock at any moment, so an exact match would be flaky.
    // The displayed value must lie between the stock read before the page loaded and the stock read after it.
    await expect(productPage.stock).toHaveText(/^\d+$/);
    const displayed = Number(await productPage.stock.textContent());
    const stockAfter = (await shopApi.getProduct(product.id)).stock;
    expect(displayed).toBeLessThanOrEqual(product.stock);
    expect(displayed).toBeGreaterThanOrEqual(stockAfter);
  });
});
