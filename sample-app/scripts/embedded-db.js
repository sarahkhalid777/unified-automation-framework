import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { config } from '../src/config.js';

/**
 * Runs a real PostgreSQL server distributed through npm (embedded-postgres).
 * Used for local development on machines without Docker or a PostgreSQL install.
 * CI uses a PostgreSQL service container instead.
 */
export async function startEmbeddedPostgres() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const server = new EmbeddedPostgres({
    databaseDir: config.embeddedDataDir,
    user: config.db.user,
    password: config.db.password,
    port: config.db.port,
    persistent: true,
    onLog: () => {},
  });

  if (!fs.existsSync(path.join(config.embeddedDataDir, 'PG_VERSION'))) {
    console.log(`[embedded-db] initialising data directory ${config.embeddedDataDir}`);
    await server.initialise();
  }
  await server.start();

  const admin = new pg.Client({ ...config.db, database: 'postgres' });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [config.db.database]);
  if (rowCount === 0) {
    await admin.query(`CREATE DATABASE "${config.db.database}"`);
    console.log(`[embedded-db] created database ${config.db.database}`);
  }
  await admin.end();
  console.log(`[embedded-db] PostgreSQL listening on ${config.db.host}:${config.db.port}`);
  return server;
}

if (process.argv[1].endsWith('embedded-db.js')) {
  const server = await startEmbeddedPostgres();
  const shutdown = async () => {
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  console.log('[embedded-db] press Ctrl+C to stop');
}
