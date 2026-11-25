import { defineConfig, devices, type Project, type ReporterDescription } from '@playwright/test';
import { getConfig } from './src/config/framework-config';

const config = getConfig();

// Health check, then test-data baseline, then everything that talks to the application.
const needsApp = { dependencies: ['test-data'] };

const browserProjects: Project[] = [
  { name: 'chromium', use: devices['Desktop Chrome'] },
  { name: 'firefox', use: devices['Desktop Firefox'] },
  { name: 'webkit', use: devices['Desktop Safari'] },
].map((project) => ({ ...project, ...needsApp, testDir: './tests/web' }));

const reporters: ReporterDescription[] = [
  ['list'],
  ['html', { outputFolder: 'reports/html', open: 'never' }],
  // Before Allure's reporter: it empties Allure's results folder so a report shows one run only.
  ['./src/reporting/run-summary.reporter.ts', { runsDir: 'reports/runs', keep: 20, resetDirs: ['reports/allure-results'] }],
  [
    'allure-playwright',
    {
      resultsDir: 'reports/allure-results',
      // Shown on the report's overview. Hosts and versions only - never credentials.
      environmentInfo: {
        Environment: config.environment,
        'Web base URL': config.web.baseUrl,
        'API base URL': config.api.baseUrl,
        Node: process.version,
        OS: `${process.platform} ${process.arch}`,
      },
    },
  ],
];
if (config.environment === 'ci') reporters.push(['github']);

export default defineConfig({
  testDir: './tests',
  outputDir: 'reports/test-results',
  fullyParallel: true,
  forbidOnly: config.run.forbidOnly,
  retries: config.run.retries,
  workers: config.run.workers,
  timeout: config.run.testTimeoutMs,
  expect: { timeout: config.run.expectTimeoutMs },
  reporter: reporters,

  use: {
    baseURL: config.web.baseUrl,
    headless: config.run.headless,
    actionTimeout: config.web.actionTimeoutMs,
    navigationTimeout: config.web.navigationTimeoutMs,
    testIdAttribute: 'data-testid',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'framework', testDir: './tests/framework' },

    { name: 'app-health', testDir: './tests/setup', testMatch: 'app-health.setup.ts' },
    { name: 'test-data', testDir: './tests/setup', testMatch: 'test-data.setup.ts', dependencies: ['app-health'] },

    // Trailing slash so relative paths like "customers" resolve under /api/ rather than replacing it.
    { name: 'api', testDir: './tests/api', ...needsApp, use: { baseURL: `${config.api.baseUrl}/` } },

    { name: 'database', testDir: './tests/database', ...needsApp },

    ...browserProjects,

    // One engine is enough here - cross-browser coverage is the job of tests/web.
    { name: 'integration', testDir: './tests/integration', ...needsApp, use: devices['Desktop Chrome'] },
  ],
});
