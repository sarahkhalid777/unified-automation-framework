import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

export class CartRow {
  readonly name: Locator;
  readonly unitPrice: Locator;
  readonly quantity: Locator;
  readonly lineTotal: Locator;
  private readonly updateButton: Locator;
  private readonly removeButton: Locator;

  constructor(readonly root: Locator) {
    this.name = root.getByTestId('cart-item-name');
    this.unitPrice = root.getByTestId('cart-item-unit-price');
    this.quantity = root.getByTestId('cart-item-quantity');
    this.lineTotal = root.getByTestId('cart-item-line-total');
    this.updateButton = root.getByTestId('cart-item-update');
    this.removeButton = root.getByTestId('cart-item-remove');
  }

  async changeQuantity(quantity: number): Promise<void> {
    await this.quantity.fill(String(quantity));
    await this.updateButton.click();
  }

  async remove(): Promise<void> {
    await this.removeButton.click();
  }
}

export class CartPage extends BasePage {
  protected readonly path = '/cart';

  readonly rows: Locator;
  readonly subtotal: Locator;
  readonly message: Locator;
  readonly emptyState: Locator;
  readonly proceedToCheckout: Locator;

  constructor(page: Page) {
    super(page);
    this.rows = page.getByTestId('cart-item');
    this.subtotal = page.getByTestId('cart-subtotal');
    this.message = page.getByTestId('cart-message');
    this.emptyState = page.getByTestId('cart-empty');
    this.proceedToCheckout = page.getByTestId('proceed-to-checkout');
  }

  override async waitUntilReady(): Promise<void> {
    await this.page.getByTestId('cart-content').or(this.emptyState).filter({ visible: true }).first().waitFor();
  }

  row(productName: string): CartRow {
    return new CartRow(
      this.rows.filter({ has: this.page.getByTestId('cart-item-name').getByText(productName, { exact: true }) }),
    );
  }
}
