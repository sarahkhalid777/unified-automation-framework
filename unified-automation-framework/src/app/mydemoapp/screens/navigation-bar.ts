import type { MobileActions } from '../../../mobile/mobile-actions';
import { by } from '../../../mobile/locators';

/** The header on every screen (menu, cart badge) and the side menu it opens. */
export class NavigationBar {
  private readonly menuButton;
  private readonly cartButton;
  private readonly cartBadge;

  constructor(
    private readonly ui: MobileActions,
    appPackage: string,
  ) {
    this.menuButton = by.accessibilityId('View menu');
    this.cartButton = by.accessibilityId('View cart');
    this.cartBadge = by.resourceId(appPackage, 'cartTV');
  }

  /** Number on the cart badge; the app hides the badge when the cart is empty. */
  async cartCount(): Promise<number> {
    if (!(await this.ui.isDisplayed(this.cartBadge))) return 0;
    return Number(await this.ui.textOf(this.cartBadge));
  }

  async waitForCartCount(expected: number): Promise<void> {
    await this.ui.waitUntil(async () => (await this.cartCount()) === expected, `cart badge to show ${expected}`);
  }

  async openCart(): Promise<void> {
    await this.ui.tap(this.cartButton);
  }

  async openCatalog(): Promise<void> {
    await this.ui.tap(this.menuButton);
    await this.ui.tap(by.text('Catalog'));
  }

  async openLogin(): Promise<void> {
    await this.openMenuItem('Login Menu Item');
  }

  /** Logged in when the menu offers "Log Out" instead of "Log In". Closes the menu again. */
  async isLoggedIn(): Promise<boolean> {
    await this.ui.tap(this.menuButton);
    await this.ui.waitForDisplayed(by.text('Catalog'));
    const loggedIn = await this.ui.isDisplayed(by.accessibilityId('Logout Menu Item'));
    await this.ui.back();
    return loggedIn;
  }

  private async openMenuItem(accessibilityId: string): Promise<void> {
    await this.ui.tap(this.menuButton);
    await this.ui.tap(by.accessibilityId(accessibilityId));
  }
}
