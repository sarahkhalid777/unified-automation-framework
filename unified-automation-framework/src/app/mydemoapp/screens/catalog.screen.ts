import { Money } from '../../../data/value-objects/money';
import type { MobileActions } from '../../../mobile/mobile-actions';
import { by, type Selector } from '../../../mobile/locators';

export interface CatalogItem {
  name: string;
  price: Money;
}

export class CatalogScreen {
  private readonly heading;
  private readonly list;
  private readonly titles;
  private readonly prices;

  constructor(
    private readonly ui: MobileActions,
    private readonly appPackage: string,
  ) {
    this.heading = by.text('Products');
    this.list = by.accessibilityId('Displays all products of catalog');
    this.titles = by.resourceId(appPackage, 'titleTV');
    this.prices = by.resourceId(appPackage, 'priceTV');
  }

  async waitUntilShown(): Promise<void> {
    await this.ui.waitForDisplayed(this.list);
    await this.ui.waitForAny(this.titles);
  }

  async isShown(): Promise<boolean> {
    return (await this.ui.isDisplayed(this.heading)) && (await this.ui.isDisplayed(this.list));
  }

  /** The products currently on screen, top to bottom (the list scrolls; this is not the whole catalogue). */
  async visibleItems(): Promise<CatalogItem[]> {
    const names = await this.ui.textsOf(this.titles);
    const prices = await this.ui.textsOf(this.prices);
    return names.map((name, i) => ({ name, price: Money.parse(prices[i] ?? '') }));
  }

  /**
   * The app has no search box; finding a product means scrolling the catalogue to it.
   * Returns its listed price so a test can compare it with the details screen.
   */
  async findProduct(name: string): Promise<CatalogItem> {
    await this.ui.scrollTo(name);
    const price = await this.ui.textOf(this.siblingOf(name, 'priceTV'));
    return { name, price: Money.parse(price) };
  }

  /** Only the product image opens the details screen; the title is not tappable. */
  async openProduct(name: string): Promise<void> {
    await this.findProduct(name);
    await this.ui.tap(this.siblingOf(name, 'productIV'));
  }

  // A view in the same catalogue tile as the title with this text.
  private siblingOf(title: string, resourceId: string): Selector {
    return `android=new UiSelector().text(${JSON.stringify(title)}).fromParent(new UiSelector().resourceId("${this.appPackage}:id/${resourceId}"))` as Selector;
  }
}
