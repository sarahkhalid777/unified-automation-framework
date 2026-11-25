import { redact, redactText } from './redact';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly scope: string;
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

export type LogSink = (entry: LogEntry) => void;

export const consoleSink: LogSink = (entry) => {
  const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
  const line = `${entry.timestamp} ${entry.level.toUpperCase().padEnd(5)} [${entry.scope}] ${entry.message}${context}`;
  if (entry.level === 'error' || entry.level === 'warn') console.error(line);
  else console.log(line);
};

function levelFromEnv(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  return raw !== undefined && raw in LEVEL_ORDER ? (raw as LogLevel) : 'info';
}

// Redaction happens here rather than in callers, so logging a request body can't leak a password.
export class Logger {
  constructor(
    readonly scope: string,
    private readonly sinks: readonly LogSink[] = [consoleSink],
    private readonly minLevel: LogLevel = levelFromEnv(),
  ) {}

  child(scope: string): Logger {
    return new Logger(`${this.scope}:${scope}`, this.sinks, this.minLevel);
  }

  withSinks(...sinks: LogSink[]): Logger {
    return new Logger(this.scope, [...this.sinks, ...sinks], this.minLevel);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.write('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.write('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.write('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.write('error', message, context);
  }

  private write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      scope: this.scope,
      message: redactText(message),
      ...(context ? { context: redact(context) } : {}),
    };
    for (const sink of this.sinks) sink(entry);
  }
}

export function createLogger(scope: string): Logger {
  return new Logger(scope);
}
