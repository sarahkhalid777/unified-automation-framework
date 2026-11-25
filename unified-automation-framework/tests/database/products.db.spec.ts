import { ProductRepository } from '@framework/app/shoplite/database/shoplite-database';
import { TEST_PRODUCT_SKU_PREFIX, aProduct } from '@framework/data/builders/product.builder';
import { aShippingAddress } from '@framework/data/builders/shipping-address.builder';
import { expect, test } from '@framework/fixtures/api.fixtures';
import type { DatabaseError } from 'pg';

// PostgreSQL SQLSTATE codes
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';

test.describe('Product data in PostgreSQL', { tag: ['@database', '@catalogue'] }, () => {
  test('DB-PRODUCT-001 the catalogue API serves exactly what is in the products table', async ({ db, shopApi }) => {
    // API first, then DB: stock only goes down during a run, so the DB value can only be lower or equal.
    const fromApi = (await shopApi.listProducts()).items.filter((p) => !p.sku.startsWith(TEST_PRODUCT_SKU_PREFIX));
    const fromDb = await db.products.listCatalogue();

    expect(fromApi.map((p) => p.id).sort((a, b) => a - b)).toEqual(fromDb.map((p) => p.id));
    for (const row of fromDb) {
      const product = fromApi.find((p) => p.id === row.id)!;
      expect(product, `product ${row.sku}`).toMatchObject({
        sku: row.sku,
        name: row.name,
        description: row.description,
        category: row.category,
        priceCents: row.priceCents,
      });
      expect(row.stock, `stock of ${row.sku}`).toBeLessThanOrEqual(product.stock);
    }
  });

  test('DB-PRODUCT-002 database constraints reject invalid product data', async ({ db }) => {
    const existingSku = (await db.products.listCatalogue())[0]!.sku;
    // Each probe runs in a transaction that is always rolled back, so nothing is left behind even if a constraint is missing.
    const probes = [
      { name: 'negative price', code: CHECK_VIOLATION, product: aProduct().withPriceCents(-1).build() },
      { name: 'negative stock', code: CHECK_VIOLATION, product: aProduct().withStock(-1).build() },
      { name: 'duplicate SKU', code: UNIQUE_VIOLATION, product: { ...aProduct().build(), sku: existingSku } },
    ];

    for (const { name, code, product } of probes) {
      await test.step(`${name} -> SQLSTATE ${code}`, async () => {
        const error = await db.client.withRollback((tx) => new ProductRepository(tx).insert(product)).catch((e: unknown) => e);
        expect((error as DatabaseError).code, `inserting a product with ${name} should fail`).toBe(code);
      });
    }

    await test.step('Stock cannot be updated below zero either', async () => {
      const error = await db.client
        .withRollback((tx) => tx.execute('UPDATE products SET stock = -1 WHERE sku = $1', [existingSku]))
        .catch((e: unknown) => e);
      expect((error as DatabaseError).code).toBe(CHECK_VIOLATION);
    });
  });

  test('DB-PRODUCT-003 a product created in the database is sold through the API with stock enforced', async ({
    db,
    api,
    shopApi,
    cleanup,
    customerAccount,
  }) => {
    const product = await db.products.insert(aProduct().withStock(2).build());
    cleanup.add(`delete test product ${product.sku}`, () => db.products.deleteTestProduct(product.id));
    const asCustomer = api.as(customerAccount.session);

    await test.step('The API serves the new product', async () => {
      const response = await api.products.get(product.id);
      expect(response).toHaveStatus(200);
      expect(response.body).toMatchObject({ sku: product.sku, priceCents: product.priceCents, stock: 2 });
    });

    await test.step('Asking for more than the stock is refused', async () => {
      const response = await asCustomer.cart.addItem({ productId: product.id, quantity: 3 });
      expect(response).toHaveStatus(409);
      expect(response.error.code).toBe('INSUFFICIENT_STOCK');
    });

    await test.step('Buying the full stock leaves zero in the database', async () => {
      expect(await asCustomer.cart.addItem({ productId: product.id, quantity: 2 })).toHaveStatus(201);
      await shopApi.placeOrder(customerAccount.session, aShippingAddress().build());
      expect((await db.products.findById(product.id))?.stock).toBe(0);
    });

    await test.step('A sold-out product cannot be added to a cart', async () => {
      const response = await asCustomer.cart.addItem({ productId: product.id, quantity: 1 });
      expect(response).toHaveStatus(409);
    });
  });
});
