import { aShippingAddress, type ShippingAddress } from '../../../data/builders/shipping-address.builder';
import { Money } from '../../../data/value-objects/money';
import { TAX_RATE } from '../business-rules';
import type { Product } from '../model';

export interface OrderLine {
  readonly product: Product;
  readonly quantity: number;
  readonly lineTotal: Money;
}

/**
 * What a test intends to buy, plus the amounts ShopLite should charge for it.
 * Expected totals are worked out here once, from catalogue prices and the tax rule,
 * rather than in each test that places an order.
 */
export class OrderPlan {
  readonly subtotal: Money;
  readonly tax: Money;
  readonly total: Money;

  constructor(
    readonly lines: readonly OrderLine[],
    readonly shipping: ShippingAddress,
  ) {
    this.subtotal = Money.sum(lines.map((line) => line.lineTotal));
    this.tax = this.subtotal.percent(TAX_RATE);
    this.total = this.subtotal.plus(this.tax);
  }

  get itemCount(): number {
    return this.lines.reduce((sum, line) => sum + line.quantity, 0);
  }
}

export class OrderBuilder {
  private readonly lines: OrderLine[] = [];
  private shipping: ShippingAddress = aShippingAddress().build();

  withProduct(product: Product, quantity = 1): this {
    if (this.lines.some((line) => line.product.id === product.id)) {
      throw new Error(`${product.sku} is already in this order; give the total quantity in one call`);
    }
    this.lines.push({ product, quantity, lineTotal: Money.ofCents(product.priceCents).times(quantity) });
    return this;
  }

  /** Quantities 1, 2, 3... in the order given - a varied basket in one call. */
  withProducts(products: readonly Product[]): this {
    products.forEach((product, index) => this.withProduct(product, index + 1));
    return this;
  }

  shippingTo(address: ShippingAddress): this {
    this.shipping = address;
    return this;
  }

  build(): OrderPlan {
    if (this.lines.length === 0) throw new Error('An order needs at least one product');
    return new OrderPlan([...this.lines], { ...this.shipping });
  }
}

export const anOrder = (): OrderBuilder => new OrderBuilder();
