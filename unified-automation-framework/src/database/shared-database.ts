import { getDatabaseConfig } from '../config/framework-config';
import { ConfigurationError } from '../core/errors';
import { DatabaseClient } from './database-client';

// Singleton per worker process. Every test in a worker shares one connection pool
// instead of opening connections per query - Postgres connection setup is slow and
// the server's connection limit is small. Closed by the worker-scoped fixture.
let shared: DatabaseClient | undefined;

export function getSharedDatabase(): DatabaseClient {
  shared ??= DatabaseClient.connect(getDatabaseConfig());
  return shared;
}

export async function closeSharedDatabase(): Promise<void> {
  const client = shared;
  shared = undefined;
  await client?.close();
}

/** False when DB credentials are absent, so database-dependent steps can skip with a clear reason. */
export function isDatabaseConfigured(): boolean {
  try {
    getDatabaseConfig();
    return true;
  } catch (error) {
    if (error instanceof ConfigurationError) return false;
    throw error;
  }
}
