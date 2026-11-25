import type { Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  protected readonly path = '/login';

  readonly email: Locator = this.page.getByTestId('login-email');
  readonly password: Locator = this.page.getByTestId('login-password');
  readonly submit: Locator = this.page.getByTestId('login-submit');
  readonly error: Locator = this.page.getByTestId('login-error');
  readonly notice: Locator = this.page.getByTestId('login-notice');

  async logIn(credentials: { email: string; password: string }): Promise<void> {
    await this.email.fill(credentials.email);
    await this.password.fill(credentials.password);
    await this.submit.click();
  }
}
