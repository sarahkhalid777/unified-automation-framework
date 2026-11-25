import { config } from '../src/config.js';

/**
 * One-command local start: optional embedded PostgreSQL -> schema -> seed -> HTTP server.
 */
let embedded;
if (config.embeddedDb) {
  const { startEmbeddedPostgres } = await import('./embedded-db.js');
  embedded = await startEmbeddedPostgres();
}

const { migrate } = await import('./migrate.js');
const { seed } = await import('./seed.js');
await migrate();
await seed();

const { startServer } = await import('../src/server.js');
const server = await startServer();

const shutdown = async () => {
  server.close();
  if (embedded) await embedded.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
