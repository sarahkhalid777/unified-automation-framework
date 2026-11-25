import { Money } from '../../../data/value-objects/money';
import type { MobileActions } from '../../../mobile/mobile-actions';
import { by, type Selector } from '../../../mobile/locators';

export interface CartLine {
  name: string;
  unitPrice: Money;
  quantity: number;
}

const MAX_SCROLLS = 3;

export class CartScreen {
  private readonly heading;
  private readonly prices;
  private readonly quantities;
  private readonly itemCount;
  private readonly total;

  constructor(
    private readonly ui: MobileActions,
    appPackage: string,
  ) {
    this.heading = by.text('My Cart');
    this.prices = by.resourceId(appPackage, 'priceTV');
    this.quantities = by.resourceId(appPackage, 'noTV');
    this.itemCount = by.resourceId(appPackage, 'itemsTV');
    this.total = by.resourceId(appPackage, 'totalPriceTV');
  }

  async waitUntilShown(): Promise<void> {
    await this.ui.waitForDisplayed(this.heading);
  }

  /**
   * The cart line for one product. A row is image, then name and price, then the quantity
   * stepper underneath, so on a phone-sized screen a row's quantity is often off-screen.
   * The line is read as "the first price and quantity below this product's name", scrolling
   * until the quantity is visible.
   */
  async line(name: string): Promise<CartLine> {
    await this.waitUntilShown();
    for (let attempt = 0; ; attempt++) {
      const title = await this.ui.scrollTo(name);
      const titleY = (await title.getLocation()).y;
      const price = await this.firstBelow(this.prices, titleY);
      const quantity = await this.firstBelow(this.quantities, titleY);
      if (price && quantity) return { name, unitPrice: Money.parse(price), quantity: Number(quantity) };
      if (attempt === MAX_SCROLLS) throw new Error(`Could not read the cart line for "${name}"`);
      await this.ui.scrollDown(0.3);
    }
  }

  /** The footer: "3 Items" and "$ 89.97". */
  async summary(): Promise<{ items: number; total: Money }> {
    const items = Number.parseInt(await this.ui.textOf(this.itemCount), 10);
    return { items, total: Money.parse(await this.ui.textOf(this.total)) };
  }

  private async firstBelow(selector: Selector, y: number): Promise<string | undefined> {
    const below = (await this.ui.visibleWithPosition(selector)).find((item) => item.y > y);
    return below ? below.element.getText() : undefined;
  }
}
