import type { BrowserContext, ConsoleMessage, Request, Response } from '@playwright/test';
import { redact, redactText } from '../logging/redact';

export type BrowserEventKind = 'console-error' | 'page-error' | 'request-failed' | 'http-error';

export interface BrowserEvent {
  kind: BrowserEventKind;
  timestamp: string;
  message: string;
  url?: string;
  method?: string;
  status?: number;
  responseBody?: unknown;
}

const MAX_BODY_CHARS = 2_000;

// Collects what went wrong inside the browser during a test, for failure analysis.
// Listens at context level so pop-ups and new tabs are covered too.
export class BrowserDiagnostics {
  private readonly events: BrowserEvent[] = [];
  private readonly pending = new Set<Promise<void>>();

  constructor(context: BrowserContext) {
    context.on('console', (message) => this.onConsole(message));
    context.on('weberror', (error) => this.record({ kind: 'page-error', message: error.error().message }));
    context.on('requestfailed', (request) => this.onRequestFailed(request));
    context.on('response', (response) => this.onResponse(response));
  }

  /** Waits for response bodies still being read, then returns everything recorded. */
  async collect(): Promise<readonly BrowserEvent[]> {
    await Promise.allSettled([...this.pending]);
    return [...this.events];
  }

  async pageErrors(): Promise<BrowserEvent[]> {
    return (await this.collect()).filter((event) => event.kind === 'page-error');
  }

  private onConsole(message: ConsoleMessage): void {
    if (message.type() !== 'error') return;
    const location = message.location();
    this.record({ kind: 'console-error', message: message.text(), ...(location.url ? { url: location.url } : {}) });
  }

  private onRequestFailed(request: Request): void {
    this.record({
      kind: 'request-failed',
      method: request.method(),
      url: request.url(),
      message: request.failure()?.errorText ?? 'unknown network failure',
    });
  }

  private onResponse(response: Response): void {
    if (response.status() < 400) return;
    const request = response.request();
    const task = response
      .text()
      .then((text) => parseBody(text))
      .catch(() => undefined)
      .then((responseBody) =>
        this.record({
          kind: 'http-error',
          method: request.method(),
          url: response.url(),
          status: response.status(),
          message: `${request.method()} ${response.url()} -> ${response.status()}`,
          ...(responseBody === undefined ? {} : { responseBody }),
        }),
      );
    this.pending.add(task);
    void task.finally(() => this.pending.delete(task));
  }

  private record(event: Omit<BrowserEvent, 'timestamp'>): void {
    this.events.push(
      redact({
        ...event,
        timestamp: new Date().toISOString(),
        message: redactText(event.message),
        ...(event.url ? { url: stripQuery(event.url) } : {}),
      }),
    );
  }
}

function parseBody(text: string): unknown {
  const trimmed = text.slice(0, MAX_BODY_CHARS);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return trimmed;
  }
}

// Query strings can carry tokens or personal data; the path is enough to diagnose a failure.
function stripQuery(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.search ? `${parsed.origin}${parsed.pathname}?<query removed>` : url;
  } catch {
    return url;
  }
}

export function summarise(events: readonly BrowserEvent[]): string {
  if (events.length === 0) return 'No browser errors recorded.';
  return events.map((event) => `[${event.kind}] ${event.message}`).join('\n');
}
