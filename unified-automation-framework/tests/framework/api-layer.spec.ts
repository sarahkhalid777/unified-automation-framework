import { expect, test } from '@framework/fixtures/base.fixtures';
import { ApiResponse, bodyOf, UnexpectedResponseError } from '@framework/api/api-response';
import { SchemaValidator } from '@framework/api/schema-validator';
import { SHOPLITE_SCHEMAS, Schema } from '@framework/app/shoplite/api/schemas';
import { CleanupRegistry } from '@framework/core/cleanup';
import { Logger } from '@framework/logging/logger';

const silent = new Logger('test', []);
const response = (status: number, body: unknown) => new ApiResponse('GET', 'things/1', status, {}, body, 12, 'qa-1');

test.describe('API layer', () => {
  test('FW-API-001 schema validation reports where and why a body is wrong', () => {
    const validator = new SchemaValidator(SHOPLITE_SCHEMAS);
    const customer = {
      id: 1,
      email: 'a@b.test',
      firstName: 'A',
      lastName: 'B',
      phone: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    expect(validator.validate(Schema.customer, customer)).toEqual({ valid: true, errors: [] });

    const result = validator.validate(Schema.customer, { ...customer, id: '1', passwordHash: 'x' });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(['/id must be integer', '(root) must NOT have additional properties "passwordHash"']));
  });

  test('FW-API-002 schemas resolve references to each other', () => {
    const validator = new SchemaValidator(SHOPLITE_SCHEMAS);
    const result = validator.validate(Schema.productList, { items: [{ id: 1 }], total: 1 });
    expect(result.valid).toBe(false);
    expect(result.errors.join('\n')).toContain("/items/0 must have required property 'sku'");
  });

  test('FW-API-003 bodyOf returns the body for an expected status and explains anything else', () => {
    expect(bodyOf(response(200, { ok: true }), 200)).toEqual({ ok: true });
    expect(bodyOf(response(404, undefined), 204, 404)).toBeUndefined();
    expect(() => bodyOf(response(500, { error: 'boom' }), 200)).toThrow(UnexpectedResponseError);
    expect(() => bodyOf(response(500, { error: 'boom' }), 200)).toThrow(/Expected 200 from GET things\/1 -> 500 .*correlation qa-1/);
  });

  test('FW-API-004 cleanup runs in reverse order and survives individual failures', async () => {
    const order: string[] = [];
    const registry = new CleanupRegistry();
    registry.add('customer', () => Promise.resolve(order.push('customer')));
    registry.add('broken', () => Promise.reject(new Error('already gone')));
    registry.add('order', () => Promise.resolve(order.push('order')));

    const failed = await registry.runAll(silent);

    expect(order).toEqual(['order', 'customer']);
    expect(failed).toEqual(['broken']);
    expect(await registry.runAll(silent)).toEqual([]); // tasks run once
  });
});
