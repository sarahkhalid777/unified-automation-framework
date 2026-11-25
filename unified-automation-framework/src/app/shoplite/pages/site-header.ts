import type { Locator, Page } from '@playwright/test';

// Rendered by app.js on every page, so it is a component rather than a page.
export class SiteHeader {
  readonly root: Locator;
  readonly cartCount: Locator;
  readonly greeting: Locator;
  readonly logoutButton: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    this.root = page.locator('header.site-header');
    this.cartCount = this.root.getByTestId('cart-count');
    this.greeting = this.root.getByTestId('user-greeting');
    this.logoutButton = this.root.getByTestId('logout-button');
    this.loginLink = this.root.getByTestId('login-link');
  }

  async logOut(): Promise<void> {
    await this.logoutButton.click();
  }
}
