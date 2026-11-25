import type { EnvReader } from './env-reader';

export const ENVIRONMENT_NAMES = ['local', 'ci'] as const;
export type EnvironmentName = (typeof ENVIRONMENT_NAMES)[number];

export interface RunPolicy {
  readonly headless: boolean;
  // number, or a CPU percentage like "50%"; undefined = Playwright default
  readonly workers: number | string | undefined;
  readonly retries: number;
  readonly forbidOnly: boolean;
}

// HEADED / WORKERS / RETRIES still override whatever the strategy picks.
export interface EnvironmentStrategy {
  readonly name: EnvironmentName;
  runPolicy(env: EnvReader): RunPolicy;
}

function workersOverride(env: EnvReader): number | string | undefined {
  const raw = env.optional('WORKERS');
  if (raw === undefined) return undefined;
  return /^\d+%$/.test(raw) ? raw : env.int('WORKERS', undefined, { min: 1 });
}

// No retries locally - a flaky test should be noticed, not hidden.
export class LocalEnvironmentStrategy implements EnvironmentStrategy {
  readonly name = 'local' as const;

  runPolicy(env: EnvReader): RunPolicy {
    return {
      headless: !env.bool('HEADED', false),
      workers: workersOverride(env),
      retries: env.int('RETRIES', 0, { min: 0 }),
      forbidOnly: false,
    };
  }
}

export class CiEnvironmentStrategy implements EnvironmentStrategy {
  readonly name = 'ci' as const;

  runPolicy(env: EnvReader): RunPolicy {
    return {
      headless: true,
      workers: workersOverride(env) ?? '50%',
      retries: env.int('RETRIES', 2, { min: 0 }),
      forbidOnly: true,
    };
  }
}

const strategies: Record<EnvironmentName, EnvironmentStrategy> = {
  local: new LocalEnvironmentStrategy(),
  ci: new CiEnvironmentStrategy(),
};

export function resolveEnvironmentStrategy(env: EnvReader): EnvironmentStrategy {
  const fallback: EnvironmentName = env.bool('CI', false) ? 'ci' : 'local';
  return strategies[env.oneOf('TEST_ENV', ENVIRONMENT_NAMES, fallback)];
}
