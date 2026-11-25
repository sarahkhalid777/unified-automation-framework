import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${name}. See sample-app/.env.example.`);
  }
  return value;
}

export const config = Object.freeze({
  appRoot,
  port: Number(process.env.APP_PORT ?? 3000),
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'shoplite',
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
  },
  jwtSecret: required('JWT_SECRET'),
  jwtTtl: process.env.JWT_TTL ?? '2h',
  logFile: path.resolve(appRoot, process.env.APP_LOG_FILE ?? 'logs/app.log'),
  embeddedDb: process.env.DB_EMBEDDED === 'true',
  embeddedDataDir: path.resolve(appRoot, process.env.DB_EMBEDDED_DATA_DIR ?? '.pgdata'),
});
