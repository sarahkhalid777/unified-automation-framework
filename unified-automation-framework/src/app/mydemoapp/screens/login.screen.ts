import type { MobileActions } from '../../../mobile/mobile-actions';
import { by } from '../../../mobile/locators';

export class LoginScreen {
  private readonly username;
  private readonly password;
  private readonly submit;
  private readonly usernameError;
  private readonly passwordError;

  constructor(
    private readonly ui: MobileActions,
    appPackage: string,
  ) {
    this.username = by.resourceId(appPackage, 'nameET');
    this.password = by.resourceId(appPackage, 'passwordET');
    this.submit = by.accessibilityId('Tap to login with given credentials');
    this.usernameError = by.resourceId(appPackage, 'nameErrorTV');
    // The app shows both "Enter Password" and "user has been locked out" here.
    this.passwordError = by.resourceId(appPackage, 'passwordErrorTV');
  }

  async waitUntilShown(): Promise<void> {
    await this.ui.waitForDisplayed(this.submit);
  }

  async isShown(): Promise<boolean> {
    return this.ui.isDisplayed(this.submit);
  }

  async logIn(username: string, password: string): Promise<void> {
    await this.waitUntilShown();
    await this.ui.type(this.username, username);
    await this.ui.type(this.password, password, { sensitive: true });
    await this.ui.hideKeyboard();
    await this.ui.tap(this.submit);
  }

  async usernameErrorText(): Promise<string> {
    return this.ui.textOf(this.usernameError);
  }

  async passwordErrorText(): Promise<string> {
    return this.ui.textOf(this.passwordError);
  }
}
