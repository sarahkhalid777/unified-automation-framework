import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class OrdersPage extends BasePage {
  protected readonly path = '/orders';

  readonly table: Locator = this.page.getByTestId('orders-table');
  readonly rows: Locator = this.table.locator('tbody tr');
  readonly emptyState: Locator = this.page.getByTestId('orders-empty');

  override async waitUntilReady(): Promise<void> {
    await this.table.or(this.emptyState).filter({ visible: true }).first().waitFor();
  }

  row(orderNumber: string): Locator {
    return this.rows.filter({ hasText: orderNumber });
  }
}
