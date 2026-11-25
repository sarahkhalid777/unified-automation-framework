import type { Locator } from '@playwright/test';
import { OrderNumber } from '../value-objects/order-number';
import { BasePage } from './base.page';

export class ConfirmationPage extends BasePage {
  protected readonly path = '/confirmation';

  readonly panel: Locator = this.page.getByTestId('order-confirmation');
  readonly orderNumber: Locator = this.panel.getByTestId('order-number');
  readonly status: Locator = this.panel.getByTestId('order-status');
  readonly items: Locator = this.panel.getByTestId('order-item');
  readonly total: Locator = this.panel.getByTestId('order-total');
  readonly shipping: Locator = this.panel.getByTestId('order-shipping');
  readonly error: Locator = this.page.getByTestId('confirmation-error');

  /** The order number from the URL (?order=...), available as soon as checkout redirects. */
  orderNumberFromUrl(): OrderNumber {
    const value = new URL(this.page.url()).searchParams.get('order');
    if (!value) throw new Error(`No order number in confirmation URL ${this.page.url()}`);
    return OrderNumber.parse(value);
  }
}
