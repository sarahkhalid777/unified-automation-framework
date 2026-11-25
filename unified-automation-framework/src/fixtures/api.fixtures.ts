import { expect as baseExpect } from '@playwright/test';
import { ApiClientFactory } from '../api/api-client.factory';
import { ApiResponse } from '../api/api-response';
import { SchemaValidator } from '../api/schema-validator';
import { SHOPLITE_SCHEMAS } from '../app/shoplite/api/schemas';
import { ShopLiteEndpoints } from '../app/shoplite/api/shoplite-endpoints';
import { ShopLiteDatabase } from '../app/shoplite/database/shoplite-database';
import type { AuthSession } from '../app/shoplite/model';
import { ShopLiteApi } from '../app/shoplite/shoplite-api';
import { getConfig } from '../config/framework-config';
import { CleanupRegistry } from '../core/cleanup';
import { aCustomer, type CustomerData } from '../data/builders/customer.builder';
import { closeSharedDatabase, getSharedDatabase } from '../database/shared-database';
import { createLogger } from '../logging/logger';
import { test as base } from './base.fixtures';

const log = createLogger('fixtures');
const schemas = new SchemaValidator(SHOPLITE_SCHEMAS);

export interface CustomerAccount {
  credentials: CustomerData;
  session: AuthSession;
}

export interface ApiFixtures {
  apiClientFactory: ApiClientFactory;
  /** Anonymous ShopLite endpoints returning raw responses. Use `api.as(session)` to call as a customer. */
  api: ShopLiteEndpoints;
  /** Convenience calls for arranging state; they throw on an unexpected status. */
  shopApi: ShopLiteApi;
  /** Register clean-up for data a test creates; it runs after the test even if the test fails. */
  cleanup: CleanupRegistry;
  /** A new customer for this test only, deleted afterwards. */
  customerAccount: CustomerAccount;
}

export interface DatabaseWorkerFixtures {
  /** ShopLite repositories over the worker's shared connection pool. */
  db: ShopLiteDatabase;
}

export const test = base.extend<ApiFixtures, DatabaseWorkerFixtures>({
  // Worker-scoped: the pool is opened on first use in a worker and closed when the worker ends.
  // Tests that never touch the database never connect, so they don't need DB credentials.
  db: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use(new ShopLiteDatabase(getSharedDatabase()));
      await closeSharedDatabase();
    },
    { scope: 'worker' },
  ],

  apiClientFactory: async ({ playwright, traceId }, use, testInfo) => {
    const factory = new ApiClientFactory(playwright, getConfig().api, traceId);
    await use(factory);

    const exchanges = factory.recordedExchanges();
    if (testInfo.status !== testInfo.expectedStatus && exchanges.length > 0) {
      await testInfo.attach('api-exchanges.json', { body: JSON.stringify(exchanges, null, 2), contentType: 'application/json' });
    }
    await factory.dispose();
  },

  api: async ({ apiClientFactory }, use) => use(new ShopLiteEndpoints(await apiClientFactory.create())),

  shopApi: async ({ api }, use) => use(new ShopLiteApi(api)),

  // Depends on shopApi so it is torn down first, while the API connection is still open.
  cleanup: async ({ shopApi: _shopApi }, use, testInfo) => {
    const registry = new CleanupRegistry();
    await use(registry);
    const failed = await registry.runAll(log);
    if (failed.length > 0) testInfo.annotations.push({ type: 'cleanup-failed', description: failed.join('; ') });
  },

  customerAccount: async ({ shopApi, cleanup }, use) => {
    const credentials = aCustomer().build();
    const customer = await shopApi.registerCustomer(credentials);
    const session = await shopApi.logIn(credentials.email, credentials.password);
    cleanup.add(`delete customer ${customer.id}`, () => shopApi.deleteCustomer(session));
    await use({ credentials, session });
  },
});

export const expect = baseExpect.extend({
  toHaveStatus(response: ApiResponse, expected: number) {
    const pass = response.status === expected;
    return {
      pass,
      name: 'toHaveStatus',
      expected,
      actual: response.status,
      message: () =>
        `${this.utils.matcherHint('toHaveStatus', undefined, undefined, { isNot: this.isNot })}\n\n` +
        `Expected status: ${this.isNot ? 'not ' : ''}${expected}\nReceived: ${response.toString()}\n` +
        `Body: ${JSON.stringify(response.body, null, 2)}`,
    };
  },

  toMatchSchema(received: unknown, schemaId: string) {
    const body: unknown = received instanceof ApiResponse ? received.body : received;
    const result = schemas.validate(schemaId, body);
    return {
      pass: result.valid,
      name: 'toMatchSchema',
      message: () =>
        this.isNot
          ? `Expected body not to match ${schemaId}`
          : `Body does not match ${schemaId}:\n  ${result.errors.join('\n  ')}\n\nBody: ${JSON.stringify(body, null, 2)}`,
    };
  },
});
