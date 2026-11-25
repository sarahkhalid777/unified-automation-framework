import { isDatabaseConfigured } from '@framework/database/shared-database';
import { test as setup } from '@framework/fixtures/api.fixtures';
import { createLogger } from '@framework/logging/logger';

const log = createLogger('setup');

// Enough for a full parallel run on three browsers with repeats; orders take 1-3 units each.
const MINIMUM_STOCK = 50;
// Anything older than this was left by a run that crashed before its cleanup ran.
const STALE_AFTER_MINUTES = 60;

// File-level, so it is decided before the db fixture tries to connect.
setup.skip(!isDatabaseConfigured(), 'Database credentials not set; skipping test data baseline');

// Runs once after the health check, before every project that touches the application.
setup('test data baseline: stale data removed, stock topped up', async ({ db }) => {
  const customers = await db.customers.deleteStaleTestCustomers(STALE_AFTER_MINUTES);
  const products = await db.products.deleteStaleTestProducts(STALE_AFTER_MINUTES);
  const restocked = await db.products.ensureMinimumStock(MINIMUM_STOCK);

  log.info('Test data baseline ready', {
    staleCustomersRemoved: customers,
    staleTestProductsRemoved: products,
    productsRestocked: restocked,
  });
});
