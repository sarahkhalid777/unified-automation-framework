import { createLogger } from '../../logging/logger';
import { MobileActions } from '../../mobile/mobile-actions';
import type { MobileConfig } from '../../mobile/mobile-config';
import { CartScreen } from './screens/cart.screen';
import { CatalogScreen } from './screens/catalog.screen';
import { LoginScreen } from './screens/login.screen';
import { NavigationBar } from './screens/navigation-bar';
import { ProductScreen } from './screens/product.screen';

/**
 * Sauce Labs "My Demo App" (Android, open source), used because ShopLite has no native app.
 * One object per session gives tests the screens and a way back to a clean start.
 */
export class MyDemoApp {
  readonly nav: NavigationBar;
  readonly catalog: CatalogScreen;
  readonly product: ProductScreen;
  readonly cart: CartScreen;
  readonly login: LoginScreen;
  private readonly log = createLogger('mobile');

  constructor(
    private readonly driver: WebdriverIO.Browser,
    private readonly config: MobileConfig,
  ) {
    const ui = new MobileActions(driver, config.elementTimeoutMs, this.log);
    const appPackage = config.app.appPackage;
    this.nav = new NavigationBar(ui, appPackage);
    this.catalog = new CatalogScreen(ui, appPackage);
    this.product = new ProductScreen(ui, appPackage);
    this.cart = new CartScreen(ui, appPackage);
    this.login = new LoginScreen(ui, appPackage);
  }

  /**
   * Wipes the app's data (logged-in user, cart) and starts it again, so every test begins
   * on the catalogue as a new user. Much faster than reinstalling or a new Appium session.
   */
  async freshStart(): Promise<void> {
    const appId = this.config.app.appPackage;
    // If the previous test crashed the app, Android's "has stopped" dialog sits on top of
    // everything and would make this test fail for the wrong reason.
    await this.dismissCrashDialog();
    // Stop first: clearing the data of a running app kills it while its window is still closing,
    // and a launch straight after can attach to that dying window and stay blank.
    await this.driver.execute('mobile: terminateApp', { appId });
    await this.driver.execute('mobile: clearApp', { appId });
    await this.driver.execute('mobile: activateApp', { appId });
    try {
      await this.catalog.waitUntilShown();
    } catch (error) {
      // One more cold start, logged so a pattern shows up in the run log. A second failure is real.
      this.log.warn('Catalogue not shown after relaunch; restarting the app once more', {
        reason: error instanceof Error ? error.message.split('\n')[0] : String(error),
      });
      await this.driver.execute('mobile: terminateApp', { appId });
      await this.driver.execute('mobile: activateApp', { appId });
      await this.catalog.waitUntilShown();
    }
  }

  private async dismissCrashDialog(): Promise<void> {
    const closeApp = this.driver.$('android=new UiSelector().resourceId("android:id/aerr_close")');
    if (await closeApp.isExisting()) await closeApp.click();
  }
}
