import { ConfigurationError } from '../core/errors';

export type EnvSource = Readonly<Record<string, string | undefined>>;

// Source is injectable so config can be built from a plain object in unit tests.
export class EnvReader {
  constructor(private readonly source: EnvSource = process.env) {}

  optional(name: string): string | undefined {
    const value = this.source[name]?.trim();
    return value === undefined || value === '' ? undefined : value;
  }

  string(name: string, fallback?: string): string {
    const value = this.optional(name) ?? fallback;
    if (value === undefined) {
      throw new ConfigurationError(
        `Missing required environment variable ${name}. Copy .env.example to .env and set it.`,
      );
    }
    return value;
  }

  int(name: string, fallback?: number, { min = Number.MIN_SAFE_INTEGER } = {}): number {
    const raw = this.optional(name);
    if (raw === undefined) {
      if (fallback === undefined) {
        throw new ConfigurationError(`Missing required environment variable ${name}.`);
      }
      return fallback;
    }
    if (!/^-?\d+$/.test(raw)) {
      throw new ConfigurationError(`Environment variable ${name} must be an integer, got "${raw}".`);
    }
    const value = Number(raw);
    if (value < min) {
      throw new ConfigurationError(`Environment variable ${name} must be >= ${min}, got ${value}.`);
    }
    return value;
  }

  bool(name: string, fallback: boolean): boolean {
    const raw = this.optional(name)?.toLowerCase();
    if (raw === undefined) return fallback;
    if (['true', '1', 'yes'].includes(raw)) return true;
    if (['false', '0', 'no'].includes(raw)) return false;
    throw new ConfigurationError(`Environment variable ${name} must be true or false, got "${raw}".`);
  }

  url(name: string, fallback?: string): string {
    const raw = this.string(name, fallback);
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch (error) {
      throw new ConfigurationError(`Environment variable ${name} must be an absolute URL, got "${raw}".`, {
        cause: error,
      });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new ConfigurationError(`Environment variable ${name} must use http or https, got "${raw}".`);
    }
    return parsed.toString().replace(/\/+$/, '');
  }

  oneOf<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
    const raw = this.optional(name) ?? fallback;
    if (!(allowed as readonly string[]).includes(raw)) {
      throw new ConfigurationError(`Environment variable ${name} must be one of ${allowed.join(', ')}, got "${raw}".`);
    }
    return raw as T;
  }
}
