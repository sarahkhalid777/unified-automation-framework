import type { Locator } from '@playwright/test';
import type { ShippingAddress } from '../../../data/builders/shipping-address.builder';
import { BasePage } from './base.page';

const FIELD_TEST_IDS: Record<keyof ShippingAddress, string> = {
  name: 'shipping-name',
  address: 'shipping-address',
  city: 'shipping-city',
  postcode: 'shipping-postcode',
  country: 'shipping-country',
};

export class CheckoutPage extends BasePage {
  protected readonly path = '/checkout';

  readonly summaryLines: Locator = this.page.getByTestId('checkout-line');
  readonly subtotal: Locator = this.page.getByTestId('checkout-subtotal');
  readonly tax: Locator = this.page.getByTestId('checkout-tax');
  readonly total: Locator = this.page.getByTestId('checkout-total');
  readonly placeOrderButton: Locator = this.page.getByTestId('place-order');
  readonly error: Locator = this.page.getByTestId('checkout-error');

  // checkout.js attaches the submit handler only after the cart has loaded. Submitting earlier does a native
  // GET form submit instead (no order, address in the URL), so wait until the total is rendered.
  override async waitUntilReady(): Promise<void> {
    await this.total.filter({ hasText: /\$\d/ }).waitFor();
  }

  field(name: keyof ShippingAddress): Locator {
    return this.page.getByTestId(FIELD_TEST_IDS[name]);
  }

  // The app renders one validation message per API field, keyed as "shipping.<field>".
  fieldError(name: keyof ShippingAddress): Locator {
    return this.page.locator(`[data-error-for="shipping.${name}"]`);
  }

  async fillShipping(address: ShippingAddress): Promise<void> {
    for (const name of Object.keys(FIELD_TEST_IDS) as Array<keyof ShippingAddress>) {
      await this.field(name).fill(address[name]);
    }
  }

  async placeOrder(): Promise<void> {
    await this.placeOrderButton.click();
  }
}
