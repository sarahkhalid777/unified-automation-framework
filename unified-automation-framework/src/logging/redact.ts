export const REDACTED = '[REDACTED]';

// Matched after lower-casing and stripping separators: access_token, accessToken and Access-Token all hit "token".
const SENSITIVE_KEY_FRAGMENTS = ['password', 'passwd', 'secret', 'token', 'authorization', 'cookie', 'apikey', 'credential'];

export function isSensitiveKey(key: string): boolean {
  const normalised = key.toLowerCase().replace(/[^a-z]/g, '');
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalised.includes(fragment));
}

const SENSITIVE_TEXT_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, `$1${REDACTED}`],
  [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, REDACTED], // bare JWT
  [/(postgres(?:ql)?:\/\/[^:/\s]+:)[^@\s]+@/gi, `$1${REDACTED}@`], // password in a connection string
];

// Playwright error messages carry terminal colour codes; they make log files unreadable.
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPES = /\u001b\[[0-9;]*m/g;

export function redactText(text: string): string {
  return SENSITIVE_TEXT_PATTERNS.reduce(
    (result, [pattern, replacement]) => result.replace(pattern, replacement),
    text.replace(ANSI_ESCAPES, ''),
  );
}

// Deep copy with sensitive fields masked. Never mutates the input.
export function redact<T>(value: T): T {
  return redactValue(value, new WeakSet()) as T;
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return redactText(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redactValue(item, seen));
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: redactText(value.message) };
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      isSensitiveKey(key) && entry !== null && entry !== undefined ? REDACTED : redactValue(entry, seen),
    ]),
  );
}
