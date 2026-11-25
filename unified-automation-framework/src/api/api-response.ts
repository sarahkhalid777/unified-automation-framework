// Shape of ShopLite's error responses; most JSON APIs use something close to it.
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

export class ApiResponse<T = unknown> {
  constructor(
    readonly method: string,
    readonly path: string,
    readonly status: number,
    readonly headers: Readonly<Record<string, string>>,
    readonly body: T,
    readonly durationMs: number,
    readonly correlationId: string,
  ) {}

  get ok(): boolean {
    return this.status >= 200 && this.status < 300;
  }

  header(name: string): string | undefined {
    return this.headers[name.toLowerCase()];
  }

  /** The body read as an error response, for negative tests. */
  get error(): ApiErrorBody['error'] {
    const body = this.body as Partial<ApiErrorBody> | undefined;
    if (!body?.error) {
      throw new Error(`${this.method} ${this.path} (${this.status}) has no error body: ${JSON.stringify(this.body)}`);
    }
    return body.error;
  }

  toString(): string {
    return `${this.method} ${this.path} -> ${this.status} (${this.durationMs} ms, correlation ${this.correlationId})`;
  }
}

export class UnexpectedResponseError extends Error {
  constructor(
    readonly response: ApiResponse,
    readonly expected: readonly number[],
  ) {
    super(`Expected ${expected.join(' or ')} from ${response.toString()}: ${JSON.stringify(response.body)}`);
    this.name = 'UnexpectedResponseError';
  }
}

/** For arranging test data: returns the body when the status is one of `expected`, otherwise throws. */
export function bodyOf<T>(response: ApiResponse<T>, ...expected: number[]): T {
  if (!expected.includes(response.status)) throw new UnexpectedResponseError(response, expected);
  return response.body;
}
