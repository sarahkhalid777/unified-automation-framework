import { appendFileSync, writeFileSync } from 'node:fs';
import { AppLogWindow } from '@framework/logging/app-log';
import { featureOf, layerOf, parseTestTitle, severityOf } from '@framework/reporting/test-metadata';
import { expect, test } from '@framework/fixtures/base.fixtures';

const line = (fields: Record<string, unknown>) => `${JSON.stringify({ ts: '2026-11-24T10:00:00.000Z', level: 'info', ...fields })}\n`;

test.describe('Reporting metadata and application logs', () => {
  test('FW-REPORT-001 test ID, layer, area and severity are derived from the title and tags', () => {
    expect(parseTestTitle('API-ORDER-001 a valid cart becomes an order')).toEqual({
      id: 'API-ORDER-001',
      description: 'a valid cart becomes an order',
    });
    expect(parseTestTitle('INT-E2E-001 journey')?.id).toBe('INT-E2E-001');
    expect(parseTestTitle('test data baseline: stale data removed')).toBeUndefined();
    expect(parseTestTitle('API-ORDER-01 too few digits')).toBeUndefined();

    expect(layerOf('DB-CUSTOMER-002')).toBe('Database');
    expect(featureOf('WEB-AUTH-001')).toBe('Authentication');
    expect(featureOf('WEB-CART-002')).toBe('Cart');
    expect(featureOf('INT-E2E-001')).toBe('End-to-end journey');
    expect(severityOf(['@api', '@smoke'])).toBe('critical');
    expect(severityOf(['@api'])).toBe('normal');
  });

  // eslint-disable-next-line no-empty-pattern
  test('FW-REPORT-002 the application log window keeps only this test’s new lines, redacted', ({}, testInfo) => {
    const file = testInfo.outputPath('app.log');
    writeFileSync(file, line({ msg: 'before the test', correlationId: 'FW-X-001.aaa.1' }));

    const window = AppLogWindow.open(file)!;
    appendFileSync(file, line({ msg: 'GET /api/cart -> 200', correlationId: 'FW-X-001.aaa.2' }));
    appendFileSync(file, line({ msg: 'another test', correlationId: 'FW-Y-001.bbb.1' }));
    appendFileSync(file, 'not json at all\n');
    appendFileSync(file, line({ msg: 'POST /api/auth/login -> 401', correlationId: 'FW-X-001.aaa.ui', authorization: 'Bearer abc.def.ghi' }));

    const entries = window.entriesFor('FW-X-001.aaa');
    expect(entries.map((e) => e.msg)).toEqual(['GET /api/cart -> 200', 'POST /api/auth/login -> 401']);
    expect(entries[1]!.authorization).toBe('[REDACTED]');
    expect(AppLogWindow.open(testInfo.outputPath('missing.log'))).toBeUndefined();
  });

  test('FW-REPORT-003 the trace ID starts with the test ID and is accepted by ShopLite', ({ traceId }, testInfo) => {
    expect(traceId.startsWith('FW-REPORT-003.')).toBe(true);
    // The pattern ShopLite accepts for an incoming request ID; anything else is replaced by a UUID.
    expect(`${traceId}.ui`).toMatch(/^[\w.:-]{1,100}$/);
    expect(testInfo.annotations).toContainEqual({ type: 'test-id', description: 'FW-REPORT-003' });
  });
});
