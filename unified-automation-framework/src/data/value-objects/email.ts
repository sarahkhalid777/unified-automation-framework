// Email addresses compare case-insensitively and are stored lower-cased by most systems.
// Wrapping them means that rule lives here once, instead of `.toLowerCase()` at every call site.
const SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class Email {
  private constructor(readonly value: string) {}

  static of(raw: string): Email {
    const trimmed = raw.trim();
    if (!SHAPE.test(trimmed)) throw new RangeError(`Not an email address: "${raw}"`);
    return new Email(trimmed.toLowerCase());
  }

  get domain(): string {
    return this.value.slice(this.value.indexOf('@') + 1);
  }

  equals(other: Email | string): boolean {
    return this.value === (typeof other === 'string' ? Email.of(other) : other).value;
  }

  toString(): string {
    return this.value;
  }
}
