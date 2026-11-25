// Mobile execution configuration (WebdriverIO + Appium). Separate from playwright.config.ts:
// Appium sessions are slow to start and tied to one device, so they don't fit Playwright's runner.
import { rmSync } from 'node:fs';
import * as allure from 'allure-js-commons';
import { createCapabilities } from './src/mobile/capabilities.factory';
import { MobileEvidence } from './src/mobile/mobile-evidence';
import { getMobileConfig } from './src/mobile/mobile-config';
import { featureOf, layerOf, parseTestTitle, severityOf } from './src/reporting/test-metadata';

const mobile = getMobileConfig();
let evidence: MobileEvidence | undefined;

export const config: WebdriverIO.Config = {
  runner: 'local',
  tsConfigPath: './tests/mobile/tsconfig.json',
  specs: ['./tests/mobile/**/*.spec.ts'],

  // One device, so one session at a time.
  maxInstances: 1,
  capabilities: [createCapabilities(mobile)],

  hostname: mobile.appium.host,
  port: mobile.appium.port,
  services: mobile.appium.startLocally
    ? [['appium', { args: { address: mobile.appium.host, port: mobile.appium.port }, logPath: './reports/mobile' }]]
    : [],

  logLevel: 'warn',
  outputDir: './reports/mobile/wdio-logs',
  waitforTimeout: mobile.elementTimeoutMs,
  // First session on a cold emulator installs the UiAutomator2 server and the app.
  connectionRetryTimeout: 240_000,
  connectionRetryCount: 1,

  framework: 'mocha',
  mochaOpts: { ui: 'bdd', timeout: 180_000 },
  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: './reports/allure-results-mobile',
        disableWebdriverStepsReporting: true,
        disableWebdriverScreenshotsReporting: true,
        reportedEnvironmentVars: { Platform: 'Android', Device: mobile.app.deviceName, App: mobile.app.appPackage },
      },
    ],
  ],

  // Allure results hold one run only, as for the Playwright suites (see run-summary.reporter.ts).
  onPrepare: () => {
    rmSync('./reports/allure-results-mobile', { recursive: true, force: true });
  },

  before: () => {
    evidence = new MobileEvidence(browser, mobile.reportsDir, mobile.app.appPackage);
  },

  beforeTest: async (test) => {
    // Same labels as the Playwright suites, derived from the test ID in the title.
    const title = parseTestTitle(test.title);
    if (title) {
      await allure.label('testId', title.id);
      await allure.epic(layerOf(title.id));
      await allure.feature(featureOf(title.id));
      await allure.severity(severityOf(test.title.match(/@\w+/g) ?? []));
    }
    await evidence?.startTest();
  },

  afterTest: async (test, _context, result) => {
    if (!result.passed) await evidence?.captureFailure(test.title);
  },

  // A failing beforeEach skips the test, so afterTest never runs; capture the evidence here.
  afterHook: async (test, _context, result) => {
    if (!result.passed) await evidence?.captureFailure(`hook-${test.title}`);
  },
};
