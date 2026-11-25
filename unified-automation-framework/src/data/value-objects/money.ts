// Integer cents, like the ShopLite API. Only USD for now - add a currency field when a second app needs it.
export class Money {
  private constructor(readonly cents: number) {}

  static ofCents(cents: number): Money {
    if (!Number.isSafeInteger(cents) || cents < 0) {
      throw new RangeError(`Money must be a non-negative whole number of cents, got ${cents}`);
    }
    return new Money(cents);
  }

  static zero(): Money {
    return new Money(0);
  }

  /** Parses display text such as "$1,299.50". */
  static parse(text: string): Money {
    const match = /^\$?\s*([\d,]+)(?:\.(\d{2}))?$/.exec(text.trim());
    if (!match?.[1]) throw new RangeError(`Not a money amount: "${text}"`);
    return Money.ofCents(Number(match[1].replace(/,/g, '')) * 100 + Number(match[2] ?? 0));
  }

  plus(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  times(quantity: number): Money {
    if (!Number.isInteger(quantity) || quantity < 0) throw new RangeError(`Invalid quantity ${quantity}`);
    return new Money(this.cents * quantity);
  }

  /** Rounds half up to the cent, the same as Math.round in the application. */
  percent(rate: number): Money {
    return new Money(Math.round(this.cents * rate));
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  format(): string {
    return `$${(this.cents / 100).toFixed(2)}`;
  }

  toString(): string {
    return this.format();
  }

  static sum(amounts: Iterable<Money>): Money {
    let total = Money.zero();
    for (const amount of amounts) total = total.plus(amount);
    return total;
  }
}
