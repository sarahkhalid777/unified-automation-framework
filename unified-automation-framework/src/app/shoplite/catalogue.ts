import { faker } from '@faker-js/faker';
import { TEST_PRODUCT_SKU_PREFIX } from '../../data/builders/product.builder';
import type { Product } from './model';
import type { ShopLiteApi } from './shoplite-api';

// Picks products from the live catalogue instead of hard-coding names or IDs, so tests survive catalogue changes.
// Orders reduce stock; the test-data setup project tops it up before each run.
export async function pickProducts(api: ShopLiteApi, count: number, { minStock = 10 } = {}): Promise<Product[]> {
  const { items } = await api.listProducts();
  // Products created by other tests come and go mid-run, so never pick one.
  const available = items.filter((product) => product.stock >= minStock && !product.sku.startsWith(TEST_PRODUCT_SKU_PREFIX));
  if (available.length < count) {
    throw new Error(
      `Need ${count} product(s) with stock >= ${minStock}, catalogue has ${available.length}. Run the test-data setup project, or re-seed the sample app (npm run db:seed).`,
    );
  }
  return faker.helpers.arrayElements(available, count);
}

export async function pickProduct(api: ShopLiteApi, options?: { minStock?: number }): Promise<Product> {
  const [product] = await pickProducts(api, 1, options);
  return product!;
}
