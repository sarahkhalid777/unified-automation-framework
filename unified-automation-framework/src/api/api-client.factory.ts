import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import type { ApiConfig } from '../config/framework-config';
import { createLogger } from '../logging/logger';
import { ApiClient, type ApiExchange } from './api-client';
import { noAuth, type AuthStrategy } from './auth';

/**
 * The one place that knows how to build a configured ApiClient: base URL with the trailing
 * slash Playwright needs, timeout, correlation header, exchange recording. Fixtures ask the
 * factory for a client instead of wiring a request context themselves.
 */
export class ApiClientFactory {
  private context: APIRequestContext | undefined;
  private readonly exchanges: ApiExchange[] = [];

  constructor(
    private readonly playwright: PlaywrightWorkerArgs['playwright'],
    private readonly config: ApiConfig,
    private readonly correlationPrefix: string,
  ) {}

  async create(auth: AuthStrategy = noAuth): Promise<ApiClient> {
    this.context ??= await this.playwright.request.newContext({ baseURL: `${this.config.baseUrl}/` });
    return new ApiClient(
      this.context,
      {
        correlationHeader: this.config.correlationHeader,
        correlationPrefix: this.correlationPrefix,
        timeoutMs: this.config.requestTimeoutMs,
        logger: createLogger('api'),
        onExchange: (exchange) => this.exchanges.push(exchange),
      },
      auth,
    );
  }

  /** Every request made through clients from this factory, in order. Already redacted. */
  recordedExchanges(): readonly ApiExchange[] {
    return [...this.exchanges];
  }

  async dispose(): Promise<void> {
    await this.context?.dispose();
    this.context = undefined;
  }
}
