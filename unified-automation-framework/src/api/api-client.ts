import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { Logger } from '../logging/logger';
import { redact } from '../logging/redact';
import { ApiResponse } from './api-response';
import { noAuth, type AuthStrategy } from './auth';

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  params?: Record<string, string | number | boolean>;
  data?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/** One request/response pair, already redacted, kept for failure analysis. */
export interface ApiExchange {
  timestamp: string;
  correlationId: string;
  method: HttpMethod;
  path: string;
  status: number | 'NETWORK_ERROR';
  durationMs: number;
  requestBody?: unknown;
  responseBody?: unknown;
  error?: string;
}

export interface ApiClientSettings {
  correlationHeader: string;
  /** Every request ID starts with this, so all of one test's calls share a searchable prefix. */
  correlationPrefix: string;
  timeoutMs: number;
  logger: Logger;
  onExchange?: (exchange: ApiExchange) => void;
}

// Repeating these has the same effect as sending them once (RFC 9110), so a retry can't duplicate data.
const IDEMPOTENT: ReadonlySet<HttpMethod> = new Set(['GET', 'HEAD', 'PUT', 'DELETE']);
const MAX_LOGGED_BODY_CHARS = 4_000;

/**
 * Thin wrapper over Playwright's APIRequestContext. It never asserts on status codes:
 * tests decide what a correct response is, which keeps negative testing straightforward.
 * The request context's baseURL must end with "/" so paths resolve beneath it.
 */
export class ApiClient {
  private static sequence = 0;

  constructor(
    private readonly request: APIRequestContext,
    private readonly settings: ApiClientSettings,
    private readonly auth: AuthStrategy = noAuth,
  ) {}

  /** Same connection and settings, different credentials. */
  withAuth(auth: AuthStrategy): ApiClient {
    return new ApiClient(this.request, this.settings, auth);
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.send<T>('GET', path, options);
  }

  post<T>(path: string, data?: unknown, options?: RequestOptions) {
    return this.send<T>('POST', path, { ...options, data });
  }

  put<T>(path: string, data?: unknown, options?: RequestOptions) {
    return this.send<T>('PUT', path, { ...options, data });
  }

  patch<T>(path: string, data?: unknown, options?: RequestOptions) {
    return this.send<T>('PATCH', path, { ...options, data });
  }

  delete<T = undefined>(path: string, options?: RequestOptions) {
    return this.send<T>('DELETE', path, options);
  }

  async send<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const relativePath = path.replace(/^\/+/, '');
    const correlationId = `${this.settings.correlationPrefix}.${++ApiClient.sequence}`;
    const started = Date.now();
    const call = () =>
      this.request.fetch(relativePath, {
        method,
        headers: {
          Accept: 'application/json',
          [this.settings.correlationHeader]: correlationId,
          ...this.auth.headers(),
          ...options.headers,
        },
        ...(options.params ? { params: options.params } : {}),
        ...(options.data === undefined ? {} : { data: options.data }),
        timeout: options.timeoutMs ?? this.settings.timeoutMs,
      });

    let raw: APIResponse;
    try {
      raw = await this.withConnectionResetRetry(method, relativePath, call);
    } catch (error) {
      this.record({ correlationId, method, path: relativePath, status: 'NETWORK_ERROR', started, options, error });
      throw error;
    }

    const body = (await readBody(raw, method)) as T;
    const response = new ApiResponse<T>(
      method,
      relativePath,
      raw.status(),
      raw.headers(),
      body,
      Date.now() - started,
      correlationId,
    );
    this.record({ correlationId, method, path: relativePath, status: response.status, started, options, body });
    return response;
  }

  // A reused keep-alive socket can be closed by the server just as a request goes out
  // (Node's default 5 s idle timeout). Retry once, and only when repeating is harmless.
  private async withConnectionResetRetry(method: HttpMethod, path: string, call: () => Promise<APIResponse>) {
    try {
      return await call();
    } catch (error) {
      const reset = error instanceof Error && /ECONNRESET|socket hang up/i.test(error.message);
      if (!reset || !IDEMPOTENT.has(method)) throw error;
      this.settings.logger.warn(`${method} ${path} connection reset, retrying once`);
      return call();
    }
  }

  private record(entry: {
    correlationId: string;
    method: HttpMethod;
    path: string;
    status: number | 'NETWORK_ERROR';
    started: number;
    options: RequestOptions;
    body?: unknown;
    error?: unknown;
  }): void {
    const exchange: ApiExchange = redact({
      timestamp: new Date(entry.started).toISOString(),
      correlationId: entry.correlationId,
      method: entry.method,
      path: entry.path,
      status: entry.status,
      durationMs: Date.now() - entry.started,
      ...(entry.options.data === undefined ? {} : { requestBody: truncate(entry.options.data) }),
      ...(entry.body === undefined ? {} : { responseBody: truncate(entry.body) }),
      ...(entry.error instanceof Error ? { error: entry.error.message } : {}),
    });
    this.settings.logger.debug(`${exchange.method} ${exchange.path} -> ${exchange.status}`, {
      durationMs: exchange.durationMs,
      correlationId: exchange.correlationId,
    });
    this.settings.onExchange?.(exchange);
  }
}

async function readBody(response: APIResponse, method: HttpMethod): Promise<unknown> {
  if (method === 'HEAD' || response.status() === 204) return undefined;
  const text = await response.text();
  if (text === '') return undefined;
  const isJson = (response.headers()['content-type'] ?? '').includes('json');
  if (!isJson) return text;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function truncate(value: unknown): unknown {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text === undefined || text.length <= MAX_LOGGED_BODY_CHARS) return value;
  return `${text.slice(0, MAX_LOGGED_BODY_CHARS)}… (${text.length} chars)`;
}
