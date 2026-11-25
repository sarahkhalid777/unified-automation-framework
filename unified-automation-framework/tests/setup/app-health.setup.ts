import { test as setup } from '@playwright/test';
import { getConfig } from '@framework/config/framework-config';
import { EnvironmentUnavailableError } from '@framework/core/errors';
import { pollUntil } from '@framework/core/wait';
import { createLogger } from '@framework/logging/logger';

const log = createLogger('setup');

// Project dependency of web/api/integration: one clear failure instead of 50 ECONNREFUSEDs.
setup('application under test is reachable and healthy', async ({ request }) => {
  const { api } = getConfig();
  if (api.healthCheckUrl === undefined) {
    log.info('Health check disabled (HEALTHCHECK_URL=none)');
    return;
  }
  const url = api.healthCheckUrl;

  try {
    const body = await pollUntil(
      async () => {
        const response = await request.get(url, { timeout: 5_000 });
        return response.ok() ? ((await response.json()) as unknown) : undefined;
      },
      { timeoutMs: 30_000, intervalMs: 1_000, description: `a 2xx response from ${url}` },
    );
    log.info('Application under test is healthy', { url, body });
  } catch (error) {
    throw new EnvironmentUnavailableError(
      `Application under test is not healthy at ${url}. Start it first (see "Quick start" in README.md).`,
      { cause: error },
    );
  }
});
