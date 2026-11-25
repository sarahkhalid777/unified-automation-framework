import type { Page } from '@playwright/test';
import { SiteHeader } from './site-header';

export abstract class BasePage {
  readonly header: SiteHeader;
  protected abstract readonly path: string;

  constructor(readonly page: Page) {
    this.header = new SiteHeader(page);
  }

  // Pass waitUntilReady: false when the page is expected not to render, e.g. a redirect to login.
  async open(query: Record<string, string | number> = {}, { waitUntilReady = true } = {}): Promise<void> {
    const search = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)])).toString();
    await this.page.goto(search ? `${this.path}?${search}` : this.path);
    if (waitUntilReady) await this.waitUntilReady();
  }

  // ShopLite pages render from API calls made after the load event. Interacting before they finish
  // either hits missing event handlers or aborts requests mid-flight, so pages that load data override this.
  async waitUntilReady(): Promise<void> {}
}
