import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { EnvReader, type EnvSource } from './env-reader';
import { resolveEnvironmentStrategy, type EnvironmentName, type RunPolicy } from './environment-strategies';

export const FRAMEWORK_ROOT = path.resolve(__dirname, '..', '..');

export interface WebConfig {
  readonly baseUrl: string;
  readonly actionTimeoutMs: number;
  readonly navigationTimeoutMs: number;
}

export interface ApiConfig {
  readonly baseUrl: string;
  readonly requestTimeoutMs: number;
  readonly healthCheckUrl: string | undefined; // undefined = check disabled
  // Sent with every request so a test's calls can be found in the application's own log.
  readonly correlationHeader: string;
}

export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly ssl: boolean;
  readonly maxConnections: number;
}

export interface FrameworkConfig {
  readonly environment: EnvironmentName;
  readonly run: RunPolicy & {
    readonly testTimeoutMs: number;
    readonly expectTimeoutMs: number;
  };
  readonly web: WebConfig;
  readonly api: ApiConfig;
  readonly appLogFile: string | undefined;
  readonly reportsDir: string;
}

export function buildFrameworkConfig(source: EnvSource = process.env): FrameworkConfig {
  const env = new EnvReader(source);
  const strategy = resolveEnvironmentStrategy(env);
  const webBaseUrl = env.url('WEB_BASE_URL', 'http://localhost:3000');
  const apiBaseUrl = env.url('API_BASE_URL', `${webBaseUrl}/api`);
  const healthCheck = env.optional('HEALTHCHECK_URL') ?? `${apiBaseUrl}/health`;
  const appLogFile = env.optional('APP_LOG_FILE');

  return Object.freeze({
    environment: strategy.name,
    run: Object.freeze({
      ...strategy.runPolicy(env),
      testTimeoutMs: env.int('TEST_TIMEOUT_MS', 60_000, { min: 1_000 }),
      expectTimeoutMs: env.int('EXPECT_TIMEOUT_MS', 10_000, { min: 500 }),
    }),
    web: Object.freeze({
      baseUrl: webBaseUrl,
      actionTimeoutMs: env.int('ACTION_TIMEOUT_MS', 15_000, { min: 500 }),
      navigationTimeoutMs: env.int('NAVIGATION_TIMEOUT_MS', 30_000, { min: 1_000 }),
    }),
    api: Object.freeze({
      baseUrl: apiBaseUrl,
      requestTimeoutMs: env.int('API_TIMEOUT_MS', 15_000, { min: 500 }),
      healthCheckUrl: healthCheck.toLowerCase() === 'none' ? undefined : env.url('HEALTHCHECK_URL', healthCheck),
      correlationHeader: env.string('CORRELATION_HEADER', 'x-correlation-id'),
    }),
    appLogFile: appLogFile === undefined ? undefined : path.resolve(FRAMEWORK_ROOT, appLogFile),
    reportsDir: path.resolve(FRAMEWORK_ROOT, 'reports'),
  });
}

// Kept separate from the main config so a web-only run doesn't need DB credentials.
// No defaults for user/password on purpose.
export function buildDatabaseConfig(source: EnvSource = process.env): DatabaseConfig {
  const env = new EnvReader(source);
  return Object.freeze({
    host: env.string('DB_HOST', 'localhost'),
    port: env.int('DB_PORT', 5432, { min: 1 }),
    database: env.string('DB_NAME'),
    user: env.string('DB_USER'),
    password: env.string('DB_PASSWORD'),
    ssl: env.bool('DB_SSL', false),
    maxConnections: env.int('DB_POOL_MAX', 5, { min: 1 }),
  });
}

let dotenvLoaded = false;

// dotenv never overwrites variables that are already set, so CI/shell values win over .env.
export function ensureDotenvLoaded(): void {
  if (dotenvLoaded) return;
  loadDotenv({ path: path.join(FRAMEWORK_ROOT, '.env'), quiet: true });
  dotenvLoaded = true;
}

let cachedConfig: FrameworkConfig | undefined;

export function getConfig(): FrameworkConfig {
  ensureDotenvLoaded();
  cachedConfig ??= buildFrameworkConfig();
  return cachedConfig;
}

export function getDatabaseConfig(): DatabaseConfig {
  ensureDotenvLoaded();
  return buildDatabaseConfig();
}
