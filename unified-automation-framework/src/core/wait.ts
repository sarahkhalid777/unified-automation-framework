import { setTimeout as delay } from 'node:timers/promises';

export interface PollOptions {
  readonly timeoutMs: number;
  readonly intervalMs?: number;
  readonly description: string;
}

// For things Playwright can't auto-wait on (service start-up, a DB row appearing).
// Inside a page, use web-first assertions instead.
export async function pollUntil<T>(
  probe: () => Promise<T | undefined>,
  { timeoutMs, intervalMs = 500, description }: PollOptions,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  for (;;) {
    try {
      const result = await probe();
      if (result !== undefined) return result;
    } catch (error) {
      lastError = error;
    }
    if (Date.now() + intervalMs > deadline) {
      const reason = lastError instanceof Error ? ` Last error: ${lastError.message}` : '';
      throw new Error(`Timed out after ${timeoutMs} ms waiting for ${description}.${reason}`, { cause: lastError });
    }
    await delay(intervalMs);
  }
}
