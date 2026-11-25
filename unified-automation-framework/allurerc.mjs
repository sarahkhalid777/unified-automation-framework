import { defineConfig } from 'allure';

// Report settings for `npm run report:allure`. Results come from allure-playwright (see
// playwright.config.ts); this file only controls how they are presented and remembered.
export default defineConfig({
  name: 'ShopLite – Unified Automation',
  output: './reports/allure-report',

  // One line per test per run, appended on every generate. This is what gives the report its
  // history and "flaky"/"new failure" markers; Allure's raw results only cover the last run.
  historyPath: './reports/history/allure-history.jsonl',
  historyLimit: 30,

  // Failures sorted by cause rather than by test. Checked top to bottom; first match wins.
  categories: [
    {
      name: 'Application unavailable',
      matchers: { statuses: ['failed', 'broken'], message: /is not reachable|ECONNREFUSED|EnvironmentUnavailable/ },
    },
    {
      name: 'API contract: response does not match its schema',
      matchers: { statuses: ['failed'], message: /does not match https:\/\/schemas/ },
    },
    {
      name: 'API: unexpected status code',
      matchers: { statuses: ['failed'], message: /toHaveStatus|Expected status/ },
    },
    {
      name: 'Web: JavaScript error in the page',
      matchers: { statuses: ['failed'], message: /Uncaught errors in the page/ },
    },
    {
      name: 'Timeouts',
      matchers: { statuses: ['failed', 'broken'], message: /Timeout \d+ms exceeded|Timed out after/ },
    },
  ],

  plugins: {
    awesome: {
      options: {
        reportName: 'ShopLite – Unified Automation',
        // Layer (epic) > area (feature): the way the test plan is organised.
        groupBy: ['epic', 'feature'],
      },
    },
  },
});
