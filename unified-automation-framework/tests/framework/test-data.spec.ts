import { expect, test } from '@framework/fixtures/base.fixtures';
import { aCustomer } from '@framework/data/builders/customer.builder';
import { aShippingAddress } from '@framework/data/builders/shipping-address.builder';
import { Money } from '@framework/data/value-objects/money';

test.describe('Test data', () => {
  test('FW-DATA-001 Money parses, formats and does arithmetic in whole cents', () => {
    expect(Money.parse('$1,299.50').cents).toBe(129_950);
    expect(Money.parse('59.99').equals(Money.ofCents(5_999))).toBe(true);
    expect(Money.ofCents(5_999).times(3).format()).toBe('$179.97');
    // 8% of $0.31 = 2.48 cents, rounded to 2 - same rounding as the application.
    expect(Money.ofCents(31).percent(0.08).cents).toBe(2);
    expect(Money.sum([Money.ofCents(100), Money.ofCents(250)]).format()).toBe('$3.50');
  });

  test('FW-DATA-002 Money rejects values that are not whole, non-negative cents', () => {
    expect(() => Money.ofCents(-1)).toThrow(RangeError);
    expect(() => Money.ofCents(10.5)).toThrow(RangeError);
    expect(() => Money.parse('ten dollars')).toThrow(RangeError);
  });

  test('FW-DATA-003 generated customers are unique and satisfy the password rule', () => {
    const customers = Array.from({ length: 50 }, () => aCustomer().build());

    expect(new Set(customers.map((c) => c.email)).size).toBe(50);
    for (const customer of customers) {
      expect(customer.password).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/);
    }
  });

  test('FW-DATA-004 builders apply overrides without affecting other fields', () => {
    const customer = aCustomer().withFirstName('Ada').withEmail('ada@example.test').build();
    const address = aShippingAddress().withPostcode('SW1A 1AA').build();

    expect(customer).toMatchObject({ firstName: 'Ada', email: 'ada@example.test' });
    expect(customer.lastName).not.toBe('');
    expect(address.postcode).toBe('SW1A 1AA');
    expect(address.name).not.toBe('');
  });
});
