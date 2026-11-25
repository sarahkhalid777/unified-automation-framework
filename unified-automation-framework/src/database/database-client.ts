import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';
import type { DatabaseConfig } from '../config/framework-config';
import { createLogger, type Logger } from '../logging/logger';

type Queryable = Pick<Pool, 'query'> | PoolClient;

// node-postgres returns BIGINT/BIGSERIAL as strings because they can exceed Number's precision.
// IDs in a test database never get near that, and numbers compare directly with API responses.
// Values that really are too large fail loudly instead of being rounded.
const INT8 = 20;
const parseInt8 = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new RangeError(`BIGINT ${value} is too large for a JavaScript number`);
  return parsed;
};
type TextParser = (value: string) => unknown;
const defaultParser = (oid: number): TextParser => types.getTypeParser(oid, 'text') as TextParser;
const typeParsers = {
  getTypeParser: ((oid: number) => (oid === INT8 ? parseInt8 : defaultParser(oid))) as typeof types.getTypeParser,
};

/**
 * Parameterised SQL over a node-postgres pool. Values always go in `params`
 * ($1, $2, ...), never into the SQL string, so test data can't break or inject SQL.
 */
export class DatabaseClient {
  private constructor(
    private readonly connection: Queryable,
    private readonly pool: Pool | undefined,
    private readonly log: Logger,
  ) {}

  static connect(config: DatabaseConfig, log: Logger = createLogger('db')): DatabaseClient {
    const pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: true } : false,
      max: config.maxConnections,
      types: typeParsers,
    });
    pool.on('error', (error) => log.error('Idle database connection failed', { error }));
    return new DatabaseClient(pool, pool, log);
  }

  async query<T extends QueryResultRow>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    return (await this.run<T>(sql, params)).rows;
  }

  /** Exactly one row, or an error saying how many there were. */
  async one<T extends QueryResultRow>(sql: string, params: readonly unknown[] = []): Promise<T> {
    const rows = await this.query<T>(sql, params);
    if (rows.length !== 1) throw new Error(`Expected exactly one row, got ${rows.length}: ${firstLine(sql)}`);
    return rows[0]!;
  }

  async maybeOne<T extends QueryResultRow>(sql: string, params: readonly unknown[] = []): Promise<T | undefined> {
    const rows = await this.query<T>(sql, params);
    if (rows.length > 1) throw new Error(`Expected at most one row, got ${rows.length}: ${firstLine(sql)}`);
    return rows[0];
  }

  /** For INSERT/UPDATE/DELETE: returns the number of affected rows. */
  async execute(sql: string, params: readonly unknown[] = []): Promise<number> {
    return (await this.run(sql, params)).rowCount ?? 0;
  }

  /** Runs `work` on one connection inside BEGIN/COMMIT; any error rolls everything back. */
  async transaction<R>(work: (tx: DatabaseClient) => Promise<R>): Promise<R> {
    return this.onConnection(async (tx, connection) => {
      await connection.query('BEGIN');
      try {
        const result = await work(tx);
        await connection.query('COMMIT');
        return result;
      } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
      }
    });
  }

  /** Runs `work` in a transaction that is always rolled back: for probing constraints without leaving data behind. */
  async withRollback<R>(work: (tx: DatabaseClient) => Promise<R>): Promise<R> {
    return this.onConnection(async (tx, connection) => {
      await connection.query('BEGIN');
      try {
        return await work(tx);
      } finally {
        await connection.query('ROLLBACK');
      }
    });
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }

  private async onConnection<R>(use: (tx: DatabaseClient, connection: PoolClient) => Promise<R>): Promise<R> {
    if (!this.pool) throw new Error('Nested transactions are not supported; use the transaction client you were given');
    const connection = await this.pool.connect();
    try {
      return await use(new DatabaseClient(connection, undefined, this.log), connection);
    } finally {
      connection.release();
    }
  }

  private async run<T extends QueryResultRow>(sql: string, params: readonly unknown[]) {
    const started = Date.now();
    try {
      const result = await this.connection.query<T>(sql, [...params]);
      this.log.debug(firstLine(sql), { rows: result.rowCount, durationMs: Date.now() - started });
      return result;
    } catch (error) {
      // Parameters are not logged: they can hold personal data.
      this.log.debug(`FAILED ${firstLine(sql)}`, { durationMs: Date.now() - started, error });
      throw error;
    }
  }
}

function firstLine(sql: string): string {
  return sql.trim().split('\n')[0]!.replace(/\s+/g, ' ').slice(0, 120);
}
