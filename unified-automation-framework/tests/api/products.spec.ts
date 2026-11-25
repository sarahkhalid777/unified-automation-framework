import { Schema } from '@framework/app/shoplite/api/schemas';
import { pickProduct } from '@framework/app/shoplite/catalogue';
import { expect, test } from '@framework/fixtures/api.fixtures';

test.describe('Products API', { tag: ['@api', '@catalogue'] }, () => {
  test('API-PRODUCT-001 list, search and filter products', { tag: '@smoke' }, async ({ api }) => {
    const all = await api.products.list();
    expect(all).toHaveStatus(200);
    expect(all).toMatchSchema(Schema.productList);
    const catalogue = all.body.items;
    expect(catalogue.length).toBeGreaterThan(0);
    expect(all.body.total).toBe(catalogue.length);
    expect(new Set(catalogue.map((p) => p.id)).size).toBe(catalogue.length);

    // The full catalogue is the oracle for the filtered queries below.
    await test.step('Search matches name, description or SKU, case-insensitively', async () => {
      const term = catalogue[0]!.name.split(' ')[0]!.toUpperCase();
      const expected = catalogue.filter((p) =>
        [p.name, p.description, p.sku].some((text) => text.toLowerCase().includes(term.toLowerCase())),
      );

      const response = await api.products.list({ search: term });
      expect(response).toHaveStatus(200);
      expect(response.body.items.map((p) => p.id).sort()).toEqual(expected.map((p) => p.id).sort());
      expect(response.body.total).toBe(expected.length);
    });

    await test.step('Category filter returns exactly that category', async () => {
      const category = catalogue[catalogue.length - 1]!.category;
      const expected = catalogue.filter((p) => p.category === category);

      const response = await api.products.list({ category });
      expect(response).toHaveStatus(200);
      expect(response.body.items.map((p) => p.id).sort()).toEqual(expected.map((p) => p.id).sort());
    });

    await test.step('A search with no matches returns an empty list, not an error', async () => {
      const response = await api.products.list({ search: 'zz-no-such-product-zz' });
      expect(response).toHaveStatus(200);
      expect(response.body).toEqual({ items: [], total: 0 });
    });
  });

  test('API-PRODUCT-002 retrieve a product by id', async ({ api, shopApi }) => {
    const listed = await pickProduct(shopApi, { minStock: 0 });

    const response = await api.products.get(listed.id);

    expect(response).toHaveStatus(200);
    expect(response).toMatchSchema(Schema.product);
    // Stock can change between the two calls while other tests place orders.
    const { stock: _stock, ...rest } = listed;
    expect(response.body).toMatchObject(rest);
  });

  const invalidIds = [
    { id: 'abc', status: 400, code: 'VALIDATION_ERROR' },
    { id: '0', status: 400, code: 'VALIDATION_ERROR' },
    { id: '-5', status: 400, code: 'VALIDATION_ERROR' },
    { id: '999999999', status: 404, code: 'NOT_FOUND' },
  ];
  for (const { id, status, code } of invalidIds) {
    test(`API-PRODUCT-003 product lookup is rejected for id "${id}"`, async ({ api }) => {
      const response = await api.products.get(id);

      expect(response).toHaveStatus(status);
      expect(response).toMatchSchema(Schema.error);
      expect(response.error.code).toBe(code);
    });
  }
});
