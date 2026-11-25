import path from 'node:path';
import { EnvReader, type EnvSource } from '../config/env-reader';
import { ensureDotenvLoaded, FRAMEWORK_ROOT } from '../config/framework-config';

export type MobilePlatform = 'android';

export interface AppiumServerConfig {
  readonly host: string;
  readonly port: number;
  /** When true, wdio starts and stops a local Appium server itself. Set false to use one already running. */
  readonly startLocally: boolean;
}

export interface AndroidAppConfig {
  readonly platform: 'android';
  /** adb serial ("emulator-5554") or AVD name; Appium picks the first device when it is "Android Emulator". */
  readonly deviceName: string;
  /** Start this AVD if no device is connected. Optional: locally you can start the emulator yourself. */
  readonly avd: string | undefined;
  readonly platformVersion: string | undefined;
  /** Absolute path to the .apk, installed fresh at session start. */
  readonly appPath: string;
  readonly appPackage: string;
  readonly appActivity: string;
}

export interface MobileConfig {
  readonly appium: AppiumServerConfig;
  readonly app: AndroidAppConfig;
  readonly elementTimeoutMs: number;
  /** Appium closes a session that receives no command for this long (protects a crashed run from hanging a device). */
  readonly newCommandTimeoutSec: number;
  readonly reportsDir: string;
}

export function buildMobileConfig(source: EnvSource = process.env): MobileConfig {
  const env = new EnvReader(source);
  const appPath = env.string('ANDROID_APP_PATH', '../.tools/apps/mda-2.3.0-27.apk');

  return Object.freeze({
    appium: Object.freeze({
      host: env.string('APPIUM_HOST', '127.0.0.1'),
      port: env.int('APPIUM_PORT', 4723, { min: 1 }),
      startLocally: env.bool('APPIUM_START_LOCALLY', true),
    }),
    app: Object.freeze({
      platform: 'android',
      deviceName: env.string('ANDROID_DEVICE_NAME', 'Android Emulator'),
      avd: env.optional('ANDROID_AVD'),
      platformVersion: env.optional('ANDROID_PLATFORM_VERSION'),
      appPath: path.resolve(FRAMEWORK_ROOT, appPath),
      appPackage: env.string('ANDROID_APP_PACKAGE', 'com.saucelabs.mydemoapp.android'),
      appActivity: env.string('ANDROID_APP_ACTIVITY', '.view.activities.SplashActivity'),
    }),
    elementTimeoutMs: env.int('MOBILE_ELEMENT_TIMEOUT_MS', 15_000, { min: 500 }),
    newCommandTimeoutSec: env.int('MOBILE_NEW_COMMAND_TIMEOUT_SEC', 120, { min: 10 }),
    reportsDir: path.resolve(FRAMEWORK_ROOT, 'reports', 'mobile'),
  });
}

/** Mobile settings from the environment and .env. Separate from getConfig() so a mobile run doesn't need web or DB settings. */
export function getMobileConfig(): MobileConfig {
  ensureDotenvLoaded();
  return buildMobileConfig();
}
