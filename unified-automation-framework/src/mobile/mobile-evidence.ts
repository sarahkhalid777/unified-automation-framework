import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as allure from 'allure-js-commons';
import { redactText } from '../logging/redact';

interface LogcatEntry {
  timestamp: number;
  level: string;
  message: string;
}

const MAX_LOGCAT_LINES = 300;

/**
 * Failure evidence for a mobile test: screenshot, the screen's view hierarchy and the
 * device log (logcat) for the test's duration. Attached to Allure and also written to
 * reports/mobile/<test>/ so it survives without the report.
 */
export class MobileEvidence {
  constructor(
    private readonly driver: WebdriverIO.Browser,
    private readonly reportsDir: string,
    private readonly appPackage: string,
  ) {}

  /** Reading logcat drains Appium's buffer, so doing this before a test leaves only that test's lines. */
  async startTest(): Promise<void> {
    await this.readLogcat();
  }

  async captureFailure(testName: string): Promise<void> {
    const folder = path.join(this.reportsDir, testName.replace(/[^\w.-]+/g, '-').slice(0, 80));
    mkdirSync(folder, { recursive: true });

    // Each piece separately: when the device is in a bad state the view hierarchy is often the
    // part that fails, and the screenshot and logcat are exactly what's needed to see why.
    await this.keep(folder, 'screenshot.png', 'image/png', async () => Buffer.from(await this.driver.takeScreenshot(), 'base64'));
    await this.keep(folder, 'logcat.txt', 'text/plain', async () => this.relevant(await this.readLogcat()).join('\n'));
    await this.keep(folder, 'page-source.xml', 'application/xml', () => this.driver.getPageSource());
  }

  private async keep(folder: string, name: string, contentType: string, capture: () => Promise<Buffer | string>): Promise<void> {
    try {
      const content = await capture();
      if (content.length === 0) return;
      writeFileSync(path.join(folder, name), content);
      await allure.attachment(name, content, contentType);
    } catch (error) {
      const reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
      writeFileSync(path.join(folder, `${name}.unavailable.txt`), redactText(reason ?? ''));
    }
  }

  private async readLogcat(): Promise<LogcatEntry[]> {
    try {
      return (await this.driver.getLogs('logcat')) as LogcatEntry[];
    } catch {
      return []; // some devices/drivers don't expose logcat; evidence is best-effort
    }
  }

  // The app's own lines, crashes, and anything at warning level or above.
  private relevant(entries: LogcatEntry[]): string[] {
    return entries
      .filter((e) => e.message.includes(this.appPackage) || e.message.includes('AndroidRuntime') || ['WARN', 'WARNING', 'SEVERE', 'ERROR'].includes(e.level))
      .slice(-MAX_LOGCAT_LINES)
      .map((e) => redactText(`${new Date(e.timestamp).toISOString()} ${e.level} ${e.message}`));
  }
}
