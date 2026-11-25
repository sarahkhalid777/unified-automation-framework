import { expect, test } from '@framework/fixtures/base.fixtures';
import { Logger, type LogEntry } from '@framework/logging/logger';
import { REDACTED, redact, redactText } from '@framework/logging/redact';

test.describe('Log redaction', () => {
  test('FW-LOG-001 sensitive keys are masked at any depth and in any naming style', () => {
    const input = {
      email: 'qa@example.test',
      password: 'Secret#123',
      nested: { access_token: 'abc', refreshToken: 'def', 'X-Api-Key': 'k', items: [{ Authorization: 'Bearer x' }] },
    };

    expect(redact(input)).toEqual({
      email: 'qa@example.test',
      password: REDACTED,
      nested: { access_token: REDACTED, refreshToken: REDACTED, 'X-Api-Key': REDACTED, items: [{ Authorization: REDACTED }] },
    });
    expect(input.password).toBe('Secret#123'); // the original is not mutated
  });

  test('FW-LOG-002 secrets embedded in free text are removed', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';

    expect(redactText(`Authorization: Bearer ${jwt}`)).toBe(`Authorization: Bearer ${REDACTED}`);
    expect(redactText(`token=${jwt}`)).toBe(`token=${REDACTED}`);
    expect(redactText('postgres://qa:p%40ss@db:5432/shop')).toBe(`postgres://qa:${REDACTED}@db:5432/shop`);
  });

  test('FW-LOG-005 terminal colour codes are stripped from logged text', () => {
    expect(redactText('\u001b[2m  - → GET /api/cart\u001b[22m')).toBe('  - → GET /api/cart');
  });

  test('FW-LOG-003 circular structures do not break logging', () => {
    const node: Record<string, unknown> = { name: 'cart' };
    node.self = node;

    expect(redact(node)).toEqual({ name: 'cart', self: '[Circular]' });
  });

  test('FW-LOG-004 the logger redacts before any sink sees the entry and honours the level', () => {
    const entries: LogEntry[] = [];
    const logger = new Logger('api', [(entry) => entries.push(entry)], 'info').child('customers');

    logger.debug('not recorded below the minimum level');
    logger.info('POST /customers', { body: { email: 'a@b.test', password: 'pw' } });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: 'info',
      scope: 'api:customers',
      context: { body: { email: 'a@b.test', password: REDACTED } },
    });
  });
});
