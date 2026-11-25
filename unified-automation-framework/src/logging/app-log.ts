import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';
import { redact } from './redact';

/** One line of ShopLite's JSON-lines log. Only the fields the framework relies on are typed. */
export interface AppLogEntry {
  ts: string;
  level: string;
  msg: string;
  correlationId?: string;
  [field: string]: unknown;
}

/**
 * Reads the lines ShopLite appended to its log while one test ran, and keeps those whose
 * request ID starts with the test's trace ID. Only works when the application runs on the
 * same machine and APP_LOG_FILE points at its log; otherwise it reports itself unavailable
 * and the test carries on without application logs.
 */
export class AppLogWindow {
  private constructor(
    private readonly file: string,
    private readonly startOffset: number,
  ) {}

  static open(file: string | undefined): AppLogWindow | undefined {
    if (!file || !existsSync(file)) return undefined;
    return new AppLogWindow(file, statSync(file).size);
  }

  entriesFor(traceId: string): AppLogEntry[] {
    return this.readAppended()
      .split('\n')
      .flatMap((line) => parseLine(line))
      .filter((entry) => entry.correlationId?.startsWith(traceId) === true)
      .map((entry) => redact(entry));
  }

  private readAppended(): string {
    const end = statSync(this.file).size;
    // The log was rotated or truncated mid-test: nothing reliable to report.
    if (end <= this.startOffset) return '';
    const buffer = Buffer.alloc(end - this.startOffset);
    const fd = openSync(this.file, 'r');
    try {
      readSync(fd, buffer, 0, buffer.length, this.startOffset);
    } finally {
      closeSync(fd);
    }
    return buffer.toString('utf8');
  }
}

function parseLine(line: string): AppLogEntry[] {
  if (!line.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(line);
    return typeof parsed === 'object' && parsed !== null && 'msg' in parsed ? [parsed as AppLogEntry] : [];
  } catch {
    // A line still being written when we read; the next test's window will not include it either.
    return [];
  }
}
