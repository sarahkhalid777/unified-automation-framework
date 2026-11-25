import { randomBytes } from 'node:crypto';
import { test as base, type TestInfo } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { getConfig } from '../config/framework-config';
import { pollUntil } from '../core/wait';
import { AppLogWindow } from '../logging/app-log';
import { featureOf, layerOf, parseTestTitle, severityOf, traceIdFor } from '../reporting/test-metadata';

export interface BaseFixtures {
  /**
   * Prefix of every request ID this test sends to the application; starts with the test ID.
   * Also collects ShopLite's own log lines for those requests (when APP_LOG_FILE is set).
   */
  traceId: string;
  /** Labels the test in Allure and the HTML report from its title, project and tags. */
  testMetadata: void;
}

export const test = base.extend<BaseFixtures>({
  // eslint-disable-next-line no-empty-pattern
  traceId: async ({}, use, testInfo) => {
    const id = parseTestTitle(testInfo.title)?.id;
    // retry in the ID too, so a retried attempt's log lines aren't mixed with the first attempt's.
    const traceId = traceIdFor(id, `${randomBytes(3).toString('hex')}${testInfo.retry > 0 ? `r${testInfo.retry}` : ''}`);

    // The log is read here rather than in a fixture of its own: everything that sends requests
    // depends on traceId, so this is set up before the first request and torn down after the last
    // (including clean-up calls).
    const appLog = AppLogWindow.open(getConfig().appLogFile);
    await use(traceId);
    if (appLog) await attachAppLog(appLog, traceId, testInfo);
  },

  testMetadata: [
    async ({ traceId }, use, testInfo) => {
      const title = parseTestTitle(testInfo.title);
      testInfo.annotations.push({ type: 'trace-id', description: traceId });

      if (title) {
        testInfo.annotations.push({ type: 'test-id', description: title.id });
        await allure.label('testId', title.id);
        await allure.epic(layerOf(title.id));
        await allure.feature(featureOf(title.id));
        await allure.severity(severityOf(testInfo.tags));
        await allure.description(
          [
            `**${title.id}**: ${title.description}`,
            '',
            `Layer: ${layerOf(title.id)} · Area: ${featureOf(title.id)} · Project: ${testInfo.project.name}`,
            '',
            `Application log: every request from this test carries a request ID starting with \`${traceId}\`.`,
          ].join('\n'),
        );
      }
      await use();
    },
    { auto: true },
  ],
});

async function attachAppLog(window: AppLogWindow, traceId: string, testInfo: TestInfo): Promise<void> {
  const failed = testInfo.status !== testInfo.expectedStatus;
  // ShopLite writes the line after the response is sent; give the last one a moment to land.
  const entries = failed ? await settledEntries(window, traceId) : window.entriesFor(traceId);
  const serverErrors = entries.filter((entry) => entry.level === 'error');

  if (serverErrors.length > 0) {
    testInfo.annotations.push({ type: 'app-errors', description: serverErrors.map((e) => e.msg).join('; ') });
  }
  if (entries.length > 0 && (failed || serverErrors.length > 0)) {
    await testInfo.attach('app-log.jsonl', {
      body: entries.map((entry) => JSON.stringify(entry)).join('\n'),
      contentType: 'text/plain',
    });
  }
}

async function settledEntries(window: AppLogWindow, traceId: string) {
  let previous = -1;
  return pollUntil(
    () => {
      const entries = window.entriesFor(traceId);
      const settled = entries.length === previous;
      previous = entries.length;
      return Promise.resolve(settled ? entries : undefined);
    },
    { timeoutMs: 1_000, intervalMs: 150, description: 'the application log to settle' },
  ).catch(() => window.entriesFor(traceId));
}

export { expect } from '@playwright/test';
