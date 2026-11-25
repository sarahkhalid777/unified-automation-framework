import { aProduct } from '@framework/data/builders/product.builder';
import { expect, test } from '@framework/fixtures/api.fixtures';

test.describe('Database client', { tag: ['@database', '@framework'] }, () => {
  test('DB-INFRA-001 transactions commit on success and roll back completely on error', async ({ db, cleanup }) => {
    const product = await db.products.insert(aProduct().withStock(10).build());
    cleanup.add(`delete test product ${product.sku}`, () => db.products.deleteTestProduct(product.id));
    const stock = async () => (await db.products.findById(product.id))!.stock;

    await test.step('An error after the first statement undoes it', async () => {
      const failing = db.client.transaction(async (tx) => {
        await tx.execute('UPDATE products SET stock = 3 WHERE id = $1', [product.id]);
        expect(await tx.one<{ stock: number }>('SELECT stock FROM products WHERE id = $1', [product.id])).toEqual({ stock: 3 });
        throw new Error('simulated failure');
      });
      await expect(failing).rejects.toThrow('simulated failure');
      expect(await stock()).toBe(10);
    });

    await test.step('Uncommitted changes are invisible to other connections', async () => {
      await db.client.withRollback(async (tx) => {
        await tx.execute('UPDATE products SET stock = 4 WHERE id = $1', [product.id]);
        expect(await stock()).toBe(10); // read through the pool, i.e. a different connection
      });
      expect(await stock()).toBe(10);
    });

    await test.step('A successful transaction commits', async () => {
      await db.client.transaction((tx) => tx.execute('UPDATE products SET stock = 7 WHERE id = $1', [product.id]));
      expect(await stock()).toBe(7);
    });
  });
});
