import type { Logger } from '../logging/logger';
import { scrollIntoViewByText, type Selector } from './locators';

/**
 * The few gestures the screens need, each with an explicit wait for the element first.
 * Appium has no auto-waiting like Playwright, and a fixed pause is either too short on a
 * slow emulator or wastes time on a fast one.
 */
export class MobileActions {
  constructor(
    private readonly driver: WebdriverIO.Browser,
    private readonly timeoutMs: number,
    private readonly log: Logger,
  ) {}

  async waitForDisplayed(selector: Selector, timeoutMs = this.timeoutMs): Promise<WebdriverIO.Element> {
    const element = await this.driver.$(selector).getElement();
    await element.waitForDisplayed({ timeout: timeoutMs, timeoutMsg: `${selector} was not displayed within ${timeoutMs} ms` });
    return element;
  }

  async waitForGone(selector: Selector, timeoutMs = this.timeoutMs): Promise<void> {
    await this.driver.$(selector).waitForDisplayed({
      timeout: timeoutMs,
      reverse: true,
      timeoutMsg: `${selector} was still displayed after ${timeoutMs} ms`,
    });
  }

  /** True if the element is on screen now; does not wait. */
  async isDisplayed(selector: Selector): Promise<boolean> {
    const element = this.driver.$(selector);
    return (await element.isExisting()) && (await element.isDisplayed());
  }

  async tap(selector: Selector): Promise<void> {
    this.log.debug(`tap ${selector}`);
    await (await this.waitForDisplayed(selector)).click();
  }

  /** Replaces the field's text. Pass `sensitive` for passwords so the value never reaches a log. */
  async type(selector: Selector, value: string, { sensitive = false } = {}): Promise<void> {
    this.log.debug(`type into ${selector}: ${sensitive ? '[REDACTED]' : JSON.stringify(value)}`);
    const field = await this.waitForDisplayed(selector);
    await field.clearValue();
    await field.setValue(value);
  }

  async textOf(selector: Selector): Promise<string> {
    return (await this.waitForDisplayed(selector)).getText();
  }

  /**
   * Waits until at least one element matches. `$()` is strict in WebdriverIO 10 (it throws when
   * a selector matches several elements), which is right for single targets but not for lists.
   */
  async waitForAny(selector: Selector, timeoutMs = this.timeoutMs): Promise<void> {
    await this.waitUntil(async () => (await this.driver.$$(selector).getElements()).length > 0, `any ${selector}`, timeoutMs);
  }

  async textsOf(selector: Selector): Promise<string[]> {
    await this.waitForAny(selector);
    const texts: string[] = [];
    for (const element of await this.driver.$$(selector).getElements()) texts.push(await element.getText());
    return texts;
  }

  /** Scrolls the screen's list until the text is visible and returns that view. */
  async scrollTo(text: string): Promise<WebdriverIO.Element> {
    return this.waitForDisplayed(scrollIntoViewByText(text));
  }

  /** Scrolls the middle of the screen down by a fraction of its height (UiAutomator2 gesture). */
  async scrollDown(fraction = 0.4): Promise<void> {
    const { width, height } = await this.driver.getWindowSize();
    await this.driver.execute('mobile: scrollGesture', {
      left: Math.round(width * 0.1),
      top: Math.round(height * 0.25),
      width: Math.round(width * 0.8),
      height: Math.round(height * 0.5),
      direction: 'down',
      percent: fraction,
    });
  }

  /** Elements matching the selector that are on screen now, top to bottom, with their vertical position. */
  async visibleWithPosition(selector: Selector): Promise<{ element: WebdriverIO.Element; y: number }[]> {
    const found: { element: WebdriverIO.Element; y: number }[] = [];
    for (const element of await this.driver.$$(selector).getElements()) {
      found.push({ element, y: (await element.getLocation()).y });
    }
    return found.sort((a, b) => a.y - b.y);
  }

  async hideKeyboard(): Promise<void> {
    if (await this.driver.isKeyboardShown()) await this.driver.hideKeyboard();
  }

  async back(): Promise<void> {
    await this.driver.back();
  }

  /** Waits for a condition that isn't "element displayed", e.g. a counter reaching a value. */
  async waitUntil(condition: () => Promise<boolean>, description: string, timeoutMs = this.timeoutMs): Promise<void> {
    await this.driver.waitUntil(condition, { timeout: timeoutMs, interval: 250, timeoutMsg: `Timed out after ${timeoutMs} ms waiting for ${description}` });
  }
}
