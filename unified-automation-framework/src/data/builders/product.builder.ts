import { faker } from '@faker-js/faker';

// Products created by tests carry this SKU prefix so catalogue helpers can ignore them
// and the pre-run sweep can remove any left behind by an aborted run.
export const TEST_PRODUCT_SKU_PREFIX = 'QA-';

export interface ProductData {
  sku: string;
  name: string;
  description: string;
  category: string;
  priceCents: number;
  stock: number;
}

export class ProductBuilder {
  private readonly data: ProductData = (() => {
    const suffix = faker.string.alphanumeric({ length: 8, casing: 'upper' });
    return {
      sku: `${TEST_PRODUCT_SKU_PREFIX}${suffix}`,
      name: `QA Test Item ${suffix}`,
      description: 'Created by an automated test.',
      category: 'QA',
      priceCents: faker.number.int({ min: 100, max: 20_000 }),
      stock: 10,
    };
  })();

  withPriceCents(priceCents: number): this {
    this.data.priceCents = priceCents;
    return this;
  }

  withStock(stock: number): this {
    this.data.stock = stock;
    return this;
  }

  build(): ProductData {
    return { ...this.data };
  }
}

export const aProduct = (): ProductBuilder => new ProductBuilder();
