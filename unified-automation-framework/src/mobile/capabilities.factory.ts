import { existsSync } from 'node:fs';
import { ConfigurationError } from '../core/errors';
import type { AndroidAppConfig, MobileConfig } from './mobile-config';

/** W3C capabilities with Appium's vendor prefix, as sent to the Appium server. */
export type AppiumCapabilities = Record<string, unknown> & { platformName: string };

/**
 * Builds the capabilities for one platform from validated config. It is the only place
 * that knows Appium's capability names, so tests and wdio.conf.ts never spell them out.
 * Adding iOS later means one more case here (XCUITest) and nothing else in the suite.
 */
export function createCapabilities(config: MobileConfig): AppiumCapabilities {
  switch (config.app.platform) {
    case 'android':
      return androidCapabilities(config.app, config.newCommandTimeoutSec);
  }
}

function androidCapabilities(app: AndroidAppConfig, newCommandTimeoutSec: number): AppiumCapabilities {
  if (!existsSync(app.appPath)) {
    throw new ConfigurationError(
      `Android app not found at ${app.appPath}. Set ANDROID_APP_PATH, or see the mobile section of the setup guide.`,
    );
  }
  return {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': app.deviceName,
    ...(app.platformVersion ? { 'appium:platformVersion': app.platformVersion } : {}),
    ...(app.avd ? { 'appium:avd': app.avd, 'appium:avdLaunchTimeout': 180_000 } : {}),
    'appium:app': app.appPath,
    'appium:appPackage': app.appPackage,
    'appium:appActivity': app.appActivity,
    'appium:appWaitActivity': '*',
    // Each session starts from a clean install state: no logged-in user, empty cart.
    'appium:fullReset': false,
    'appium:noReset': false,
    'appium:autoGrantPermissions': true,
    'appium:newCommandTimeout': newCommandTimeoutSec,
  };
}
