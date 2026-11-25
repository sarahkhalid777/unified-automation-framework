import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class ProductsPage extends BasePage {
  protected readonly path = '/';

  readonly searchInput: Locator = this.page.getByTestId('search-input');
  readonly searchButton: Locator = this.page.getByTestId('search-button');
  readonly resultSummary: Locator = this.page.getByTestId('result-summary');
  readonly productCards: Locator = this.page.getByTestId('product-card');

  override async waitUntilReady(): Promise<void> {
    await this.resultSummary.filter({ hasText: /\d/ }).waitFor();
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.searchButton.click();
  }

  productCard(name: string): Locator {
    return this.productCards.filter({ has: this.page.getByRole('link', { name, exact: true }) });
  }

  async openProduct(name: string): Promise<void> {
    await this.productCard(name).getByTestId('product-link').click();
  }
}
