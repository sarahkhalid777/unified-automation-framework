import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.logFile), { recursive: true });
const stream = fs.createWriteStream(config.logFile, { flags: 'a' });

/**
 * Structured JSON-lines logger. Every entry carries the request correlation id so the
 * automation framework can extract the backend log lines that belong to a single test.
 * Request bodies are never logged (they may contain passwords).
 */
function write(level, message, fields = {}) {
  const entry = { ts: new Date().toISOString(), level, msg: message, ...fields };
  stream.write(`${JSON.stringify(entry)}\n`);
  if (level !== 'debug') {
    const tag = fields.correlationId ? ` [${fields.correlationId}]` : '';
    console.log(`${entry.ts} ${level.toUpperCase()}${tag} ${message}`);
  }
}

export const logger = {
  debug: (message, fields) => write('debug', message, fields),
  info: (message, fields) => write('info', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  error: (message, fields) => write('error', message, fields),
};
