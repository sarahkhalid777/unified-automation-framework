import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class ProductDetailPage extends BasePage {
  protected readonly path = '/product';

  readonly detail: Locator = this.page.getByTestId('product-detail');
  readonly name: Locator = this.detail.getByTestId('product-name');
  readonly sku: Locator = this.detail.getByTestId('product-sku');
  readonly category: Locator = this.detail.getByTestId('product-category');
  readonly description: Locator = this.detail.getByTestId('product-description');
  readonly price: Locator = this.detail.getByTestId('product-price');
  readonly stock: Locator = this.detail.getByTestId('product-stock');
  readonly quantity: Locator = this.detail.getByTestId('product-quantity');
  readonly addToCartButton: Locator = this.detail.getByTestId('add-to-cart');
  readonly message: Locator = this.page.getByTestId('product-message');

  override async waitUntilReady(): Promise<void> {
    await this.detail.or(this.message).filter({ visible: true }).first().waitFor();
  }

  async openProduct(id: number): Promise<void> {
    await this.open({ id });
  }

  async addToCart(quantity = 1): Promise<void> {
    await this.quantity.fill(String(quantity));
    await this.addToCartButton.click();
  }
}
