import { expect, test } from '@framework/fixtures/base.fixtures';
import { buildDatabaseConfig, buildFrameworkConfig } from '@framework/config/framework-config';
import { ConfigurationError } from '@framework/core/errors';

test.describe('Framework configuration', () => {
  test('FW-CONFIG-001 local defaults point at the locally hosted application', () => {
    const config = buildFrameworkConfig({});

    expect(config.environment).toBe('local');
    expect(config.web.baseUrl).toBe('http://localhost:3000');
    expect(config.api.baseUrl).toBe('http://localhost:3000/api');
    expect(config.api.healthCheckUrl).toBe('http://localhost:3000/api/health');
    expect(config.run).toMatchObject({ headless: true, retries: 0, forbidOnly: false, workers: undefined });
  });

  test('FW-CONFIG-002 the CI strategy is selected from the CI variable and enforces CI policy', () => {
    const config = buildFrameworkConfig({ CI: 'true', HEADED: 'true' });

    expect(config.environment).toBe('ci');
    expect(config.run).toMatchObject({ headless: true, retries: 2, forbidOnly: true, workers: '50%' });
  });

  test('FW-CONFIG-003 explicit variables override strategy defaults', () => {
    const config = buildFrameworkConfig({
      TEST_ENV: 'local',
      HEADED: 'yes',
      WORKERS: '3',
      RETRIES: '1',
      WEB_BASE_URL: 'https://shop.example.test/',
      API_BASE_URL: 'https://api.example.test/v2/',
    });

    expect(config.run).toMatchObject({ headless: false, workers: 3, retries: 1 });
    expect(config.web.baseUrl).toBe('https://shop.example.test');
    expect(config.api.baseUrl).toBe('https://api.example.test/v2');
  });

  test('FW-CONFIG-004 the health check can be disabled for applications without one', () => {
    expect(buildFrameworkConfig({ HEALTHCHECK_URL: 'none' }).api.healthCheckUrl).toBeUndefined();
  });

  test('FW-CONFIG-005 invalid values fail fast with a message naming the variable', () => {
    expect(() => buildFrameworkConfig({ TEST_ENV: 'prod' })).toThrow(/TEST_ENV must be one of local, ci/);
    expect(() => buildFrameworkConfig({ WEB_BASE_URL: 'localhost:3000' })).toThrow(ConfigurationError);
    expect(() => buildFrameworkConfig({ RETRIES: 'two' })).toThrow(/RETRIES must be an integer/);
    expect(() => buildFrameworkConfig({ WORKERS: '0' })).toThrow(/WORKERS must be >= 1/);
  });

  test('FW-CONFIG-006 database credentials are required and never defaulted', () => {
    expect(() => buildDatabaseConfig({ DB_NAME: 'shop', DB_USER: 'qa' })).toThrow(/DB_PASSWORD/);

    const db = buildDatabaseConfig({ DB_NAME: 'shop', DB_USER: 'qa', DB_PASSWORD: 'from-env', DB_PORT: '6543' });
    expect(db).toEqual({
      host: 'localhost',
      port: 6543,
      database: 'shop',
      user: 'qa',
      password: 'from-env',
      ssl: false,
      maxConnections: 5,
    });
  });
});
