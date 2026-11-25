import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../src/config.js';
import { pool } from '../src/db/pool.js';

/**
 * Applies the schema. `--reset` drops all ShopLite tables first (local environments only).
 */
export async function migrate({ reset = false } = {}) {
  if (reset) {
    await pool.query('DROP TABLE IF EXISTS order_items, orders, cart_items, carts, products, customers CASCADE');
  }
  const schema = await fs.readFile(path.join(config.appRoot, 'src/db/schema.sql'), 'utf8');
  await pool.query(schema);
}

if (process.argv[1].endsWith('migrate.js')) {
  migrate({ reset: process.argv.includes('--reset') })
    .then(() => console.log('[migrate] schema applied'))
    .catch((error) => {
      console.error('[migrate] failed:', error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
