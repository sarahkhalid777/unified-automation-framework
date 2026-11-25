import { expect, test } from '@framework/fixtures/base.fixtures';
import { anOrder } from '@framework/app/shoplite/data/order.builder';
import type { CustomerId, ProductId } from '@framework/app/shoplite/ids';
import type { Product } from '@framework/app/shoplite/model';
import { OrderNumber } from '@framework/app/shoplite/value-objects/order-number';
import { Email } from '@framework/data/value-objects/email';

const product = (id: number, priceCents: number): Product => ({
  id: id as ProductId,
  sku: `SKU-${id}`,
  name: `Product ${id}`,
  description: '',
  category: 'Test',
  priceCents,
  currency: 'USD',
  stock: 10,
});

test.describe('Value objects and builders', () => {
  test('FW-VO-001 Email normalises and compares case-insensitively', () => {
    const email = Email.of('  Ada.Lovelace@Example.TEST ');

    expect(email.value).toBe('ada.lovelace@example.test');
    expect(email.domain).toBe('example.test');
    expect(email.equals('ADA.LOVELACE@example.test')).toBe(true);
    expect(() => Email.of('not-an-email')).toThrow(RangeError);
  });

  test('FW-VO-002 OrderNumber validates the format and exposes the date it was placed', () => {
    const number = OrderNumber.parse('SL-20261124-K7QF2M');

    expect(number.placedOn).toBe('2026-11-24');
    expect(number.equals('SL-20261124-K7QF2M')).toBe(true);
    expect(OrderNumber.isValid('SL-20261124-K7QF2I')).toBe(false); // I is not in the alphabet
    expect(OrderNumber.isValid('SL-2026112-K7QF2M')).toBe(false);
    expect(() => OrderNumber.parse('SL-20261399-K7QF2M')).toThrow(/invalid date/);
  });

  test('FW-VO-003 identifiers of different kinds cannot be mixed up', () => {
    const loadCustomer = (id: CustomerId) => id;
    const productId = 7 as ProductId;

    // Checked by `tsc --noEmit`: if branding stopped working, this directive would itself be an error.
    // @ts-expect-error a ProductId is not a CustomerId
    expect(loadCustomer(productId)).toBe(7);
  });

  test('FW-DATA-005 an order plan works out the amounts ShopLite should charge', () => {
    const plan = anOrder().withProduct(product(1, 1_999), 2).withProduct(product(2, 31)).build();

    expect(plan.lines.map((line) => line.lineTotal.cents)).toEqual([3_998, 31]);
    expect(plan.subtotal.cents).toBe(4_029);
    expect(plan.tax.cents).toBe(322); // 8% of 40.29 = 3.2232, rounded to the cent
    expect(plan.total.cents).toBe(4_351);
    expect(plan.itemCount).toBe(3);
  });

  test('FW-DATA-006 the order builder rejects an empty or ambiguous order', () => {
    expect(() => anOrder().build()).toThrow('at least one product');
    expect(() => anOrder().withProduct(product(1, 100)).withProduct(product(1, 100))).toThrow('already in this order');
    expect(anOrder().withProducts([product(1, 100), product(2, 100), product(3, 100)]).build().lines.map((l) => l.quantity)).toEqual([1, 2, 3]);
  });
});
