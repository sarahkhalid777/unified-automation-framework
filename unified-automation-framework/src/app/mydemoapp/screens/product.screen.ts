import { Money } from '../../../data/value-objects/money';
import type { MobileActions } from '../../../mobile/mobile-actions';
import { by } from '../../../mobile/locators';

export class ProductScreen {
  private readonly name;
  private readonly price;
  private readonly quantity;
  private readonly increase;
  private readonly decrease;
  private readonly addToCartButton;

  constructor(
    private readonly ui: MobileActions,
    appPackage: string,
  ) {
    this.name = by.resourceId(appPackage, 'productTV');
    this.price = by.resourceId(appPackage, 'priceTV');
    this.quantity = by.resourceId(appPackage, 'noTV');
    this.increase = by.accessibilityId('Increase item quantity');
    this.decrease = by.accessibilityId('Decrease item quantity');
    this.addToCartButton = by.accessibilityId('Tap to add product to cart');
  }

  async waitUntilShown(): Promise<void> {
    await this.ui.waitForDisplayed(this.addToCartButton);
  }

  async details(): Promise<{ name: string; price: Money }> {
    await this.waitUntilShown();
    return { name: await this.ui.textOf(this.name), price: Money.parse(await this.ui.textOf(this.price)) };
  }

  async quantityShown(): Promise<number> {
    return Number(await this.ui.textOf(this.quantity));
  }

  /** Uses the + / - buttons (the field is not editable). */
  async setQuantity(target: number): Promise<void> {
    let current = await this.quantityShown();
    while (current !== target) {
      await this.ui.tap(current < target ? this.increase : this.decrease);
      const next = await this.quantityShown();
      if (next === current) throw new Error(`Quantity stuck at ${current}; cannot reach ${target}`);
      current = next;
    }
  }

  async addToCart(quantity = 1): Promise<void> {
    await this.waitUntilShown();
    await this.setQuantity(quantity);
    await this.ui.tap(this.addToCartButton);
  }
}
