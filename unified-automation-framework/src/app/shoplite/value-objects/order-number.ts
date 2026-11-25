// ShopLite order numbers look like SL-20261124-K7QF2M: prefix, UTC date placed, six characters
// from an alphabet without I/O/0/1 (sample-app/src/routes/orders.js).
const FORMAT = /^SL-(\d{4})(\d{2})(\d{2})-[A-HJ-NP-Z2-9]{6}$/;

export class OrderNumber {
  private constructor(
    readonly value: string,
    /** UTC date the order was placed, as YYYY-MM-DD. */
    readonly placedOn: string,
  ) {}

  static parse(raw: string): OrderNumber {
    const match = FORMAT.exec(raw);
    if (!match) throw new RangeError(`Not a ShopLite order number: "${raw}"`);
    const placedOn = `${match[1]}-${match[2]}-${match[3]}`;
    if (Number.isNaN(Date.parse(`${placedOn}T00:00:00Z`))) throw new RangeError(`Order number has an invalid date: "${raw}"`);
    return new OrderNumber(raw, placedOn);
  }

  static isValid(raw: string): boolean {
    try {
      OrderNumber.parse(raw);
      return true;
    } catch {
      return false;
    }
  }

  equals(other: OrderNumber | string): boolean {
    return this.value === (typeof other === 'string' ? other : other.value);
  }

  toString(): string {
    return this.value;
  }
}
