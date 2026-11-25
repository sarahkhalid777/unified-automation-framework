import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { logger } from './logger.js';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what) => new ApiError(404, 'NOT_FOUND', `${what} not found`);

/** Collects field validation errors and throws a single 400 with all of them. */
export class Validator {
  constructor() {
    this.errors = [];
  }
  check(condition, field, message) {
    if (!condition) this.errors.push({ field, message });
    return this;
  }
  throwIfInvalid() {
    if (this.errors.length > 0) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', this.errors);
    }
  }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isNonEmptyString = (value, max = 200) =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
export const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

export function correlation(req, res, next) {
  const incoming = req.get('x-correlation-id');
  req.correlationId = incoming && /^[\w.:-]{1,100}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.set('x-correlation-id', req.correlationId);
  const started = process.hrtime.bigint();
  // Decided now: by the time 'finish' fires inside a mounted router, req.path has lost its /api prefix.
  const isApiRequest = req.path.startsWith('/api/');
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    if (!isApiRequest) return;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level](`${req.method} ${req.originalUrl} -> ${res.statusCode}`, {
      correlationId: req.correlationId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      customerId: req.customer?.id,
    });
  });
  next();
}

export function signToken(customer) {
  return jwt.sign({ sub: String(customer.id), email: customer.email }, config.jwtSecret, {
    expiresIn: config.jwtTtl,
  });
}

export function requireAuth(req, _res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Missing bearer token');
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.customer = { id: Number(payload.sub), email: payload.email };
  } catch {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
  next();
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, _next) {
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'MALFORMED_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  logger.error(`Unhandled error: ${error.message}`, { correlationId: req.correlationId, stack: error.stack });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } });
}
