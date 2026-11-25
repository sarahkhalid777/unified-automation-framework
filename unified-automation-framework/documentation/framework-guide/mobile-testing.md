# Mobile Testing (Android)

Mobile tests drive a real native Android app on an emulator or device through **Appium 3** and the **UiAutomator2** driver, using **WebdriverIO 10** with Mocha. They have their own runner configuration (`wdio.conf.ts`), separate from Playwright. An Appium session is slow to start and is tied to one device, which doesn't fit Playwright's test runner.

Scope for this POC is **Android only**, as agreed. iOS needs macOS with Xcode. Adding it later is one more case in `src/mobile/capabilities.factory.ts` (XCUITest) and a set of iOS screen locators.

---

## App under test

ShopLite has no native app, so the mobile suite uses **Sauce Labs "My Demo App" for Android, version 2.3.0** (open source, [github.com/saucelabs/my-demo-app-android](https://github.com/saucelabs/my-demo-app-android)). It offers a product catalogue, product details, a cart and login, which cover the brief's mobile scenarios.

---

## Infrastructure requirements

| Requirement | Used for this POC | Notes |
|---|---|---|
| Node.js | 24 | Appium 3 needs Node 20.19+ |
| Java JDK | Temurin 17 | UiAutomator2 driver and Android build tools |
| Android SDK packages | `platform-tools`, `emulator`, `build-tools;34.0.0`, `platforms;android-34`, `system-images;android-34;google_apis;x86_64` | `build-tools` provides `apksigner`, which Appium needs to install the app |
| Emulator | AVD `poc-api34`, Pixel 6 profile, Android 14 | Or a real device with USB debugging on |
| Hardware acceleration | Windows Hypervisor Platform (WHPX) | Check with `emulator -accel-check`. Without it the emulator is too slow to use |
| Memory / disk | About 4 GB RAM for the emulator, about 6 GB disk for the SDK and image | |
| Appium | `appium@3.9.1` (dev dependency) with `uiautomator2@8.7.3` in `APPIUM_HOME` | Installed by `npm run mobile:setup` |

The machine used for this POC has everything under `D:\Automation-poc\.tools` (git-ignored). Nothing is installed system-wide and no admin rights are needed. The paths go in `.env`:

```dotenv
ANDROID_HOME=D:\Automation-poc\.tools\android-sdk
JAVA_HOME=D:\Automation-poc\.tools\jdk17
APPIUM_HOME=D:\Automation-poc\.tools\appium-home
ANDROID_AVD_HOME=D:\Automation-poc\.tools\avd
ANDROID_AVD=poc-api34
ANDROID_APP_PATH=../.tools/apps/mda-2.3.0-27.apk
```

All mobile settings are listed in `.env.example`.

### One-time set-up (Windows, no admin rights)

1. Download and unzip the JDK 17 zip (Adoptium) and the Android command-line tools zip. Put the tools in `<sdk>\cmdline-tools\latest`. Check both against their published checksums.
2. Install the SDK packages. On Windows, pass them in a file: `sdkmanager.bat` runs through `cmd`, which splits `platforms;android-34` at the `;`.

   ```bat
   sdkmanager --licenses
   sdkmanager --package_file=packages.txt
   ```

   `packages.txt` contains the five packages from the table, one per line.
3. Create the emulator. Write this in a `.bat` file, for the same quoting reason:

   ```bat
   avdmanager create avd -n poc-api34 -k "system-images;android-34;google_apis;x86_64" -d pixel_6
   ```

4. `npm run mobile:setup` installs the UiAutomator2 driver into `APPIUM_HOME`.
5. Download `mda-2.3.0-27.apk` from the app's GitHub releases to `ANDROID_APP_PATH`.

---

## Running

```bash
npm run test:mobile                                              # all mobile tests
npx wdio run wdio.conf.ts --spec tests/mobile/login.spec.ts      # one file
npx wdio run wdio.conf.ts --mochaOpts.grep MOB-CART-002          # one test ID
```

- **Appium:** WebdriverIO starts and stops a local Appium server itself. Set `APPIUM_START_LOCALLY=false` to use one that is already running.
- **Emulator:** if no emulator is running, Appium starts the AVD named in `ANDROID_AVD`. Starting it yourself first is faster.
- **Reports:** results go to `reports/allure-results-mobile/`. `npm run report:allure` combines them with the web, API and database results into one report.

---

## How it is built

| Piece | File | What it does |
|---|---|---|
| Configuration | `src/mobile/mobile-config.ts` | Typed, validated settings from the environment (Appium address, device, app, timeouts) |
| Capabilities factory | `src/mobile/capabilities.factory.ts` | The only code that knows Appium's capability names. Fails early if the app file is missing |
| Locator strategies | `src/mobile/locators.ts` | Preferred order: accessibility ID, resource ID, then UiAutomator text selectors. No XPath |
| Actions and waits | `src/mobile/mobile-actions.ts` | `tap`, `type` (with `sensitive` for passwords), `textOf`, `scrollTo`, `scrollDown`, `waitForDisplayed`, `waitForAny`, `waitUntil`. Every action waits for its element first. There are no fixed sleeps |
| Evidence | `src/mobile/mobile-evidence.ts` | On failure: screenshot, view hierarchy and the device log (logcat) for that test, redacted. Saved to `reports/mobile/<test>/` and attached to Allure. Each item is captured separately, so one failing capture doesn't lose the others |
| Runner configuration | `wdio.conf.ts` | One device, one session at a time. Starts Appium. Gives tests the same Allure labels as the Playwright suites (test ID, layer, area, severity). Captures evidence after failed tests and failed hooks |
| App layer | `src/app/mydemoapp/` | Screen objects (catalogue, product, cart, login, navigation bar) and the app's demo users and messages |

Each test starts from a clean state: `MyDemoApp.freshStart()` stops the app, clears its data (logged-in user, cart) and launches it again. This takes about two seconds, much faster than a new session or a reinstall. If the previous test crashed the app, `freshStart` first dismisses Android's "app has stopped" dialog. If the catalogue doesn't appear, it restarts the app once more and logs a warning. A second failure fails the test.

Logs: the Appium server log is `reports/mobile/wdio-appium.log`, and WebdriverIO's worker logs are in `reports/mobile/wdio-logs/`.

---

## Tests

| ID | Brief scenario | What is checked |
|---|---|---|
| MOB-APP-001 | 1. Launch, 2. Landing screen | App opens on the catalogue; products have a name and a price; cart badge is empty |
| MOB-AUTH-001 | 3. Valid login | Demo user logs in, returns to the catalogue, menu offers "Log Out" |
| MOB-AUTH-002 | 4. Unsuccessful login | No username → "Username is required", still on the login screen |
| MOB-AUTH-003 | 4. Unsuccessful login | Locked-out user → "Sorry this user has been locked out.", not logged in |
| MOB-PROD-001 | 5. Search for a product | Product found in the catalogue by name, with a price. **The app has no search box**, so "search" here means scrolling the catalogue to the product |
| MOB-PROD-002 | 6. Product details | Details screen shows the same name and price as the catalogue; quantity starts at 1 |
| MOB-CART-001 | 7. Add to cart | Adding quantity 2 makes the cart badge show 2 |
| MOB-CART-002 | 8. Cart contents | Two products: each cart line has the right unit price and quantity. Item count and total match, with the total calculated from prices read in the app (`Money`) |

**Results on this machine:** all 8 tests passed on the Android 14 emulator (`poc-api34`) in two consecutive runs in Phase 8. In the final verification (Phase 10), the first run had 5 passed and 3 that did not run because of the relaunch problem described under troubleshooting. After the fix, two consecutive runs passed 8 of 8. A deliberately failing test confirmed that its screenshot, view hierarchy and logcat reach both `reports/mobile/` and Allure. That control test was then deleted.

**iOS:** not implemented and never run, as agreed.

---

## Findings in the demo app (version 2.3.0)

These are defects or limitations of the app, not of the framework. The tests avoid them deliberately, and each avoidance is commented in the code.

| # | Finding | Effect on the tests |
|---|---|---|
| 1 | Tapping most catalogue tiles crashes the app. Only the first six list positions can open, and position 1 ("Sauce Labs Backpack (green)") crashes too. Logcat shows `ArrayIndexOutOfBoundsException: length=6; index=6` for position 6 and `NullPointerException` in `ProductCatalogFragment` for position 1. | Tests that open a product use "Sauce Labs Backpack" and "Sauce Labs Backpack (orange)". "Sauce Labs Bike Light" is only scrolled to, never opened. |
| 2 | Any password is accepted for a known username. | There is no "wrong password" test: it would fail because of the app, not the framework. |
| 3 | The "Username is required" error stays on screen after a username has been entered. | Each negative login test checks only the message for its own case. |
| 4 | There is no product search. | MOB-PROD-001 finds the product by scrolling to it. |

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Could not find 'apksigner.jar'` | `build-tools` isn't installed. Install `build-tools;34.0.0` |
| Every test fails in `beforeEach` with "Timed out … waiting for the root AccessibilityNodeInfo" | An earlier app crash left a ghost "Application Error" window. `adb shell dumpsys window \| grep mCurrentFocus` shows it. Fix with `adb reboot`, or restart the emulator |
| `strict mode violation: $(…) resolved to N elements` | WebdriverIO 10's `$()` must match exactly one element. For lists, use `waitForAny` / `textsOf` |
| `this.driver.execute is not a function` | The screen objects were created before the session existed. Create them in a `before` hook, not when the spec file loads |
| A run takes far longer than about 4 minutes, with a long gap in the Appium log | Check whether the computer went to sleep: the Windows System log shows Kernel-Power events 506 and 507. Keep the machine awake during long runs. CI runners don't sleep |
| `sdkmanager` reports `Package android-34 not found` | The `;` was split by `cmd`. Use `--package_file` |
| `beforeEach` fails with "~Displays all products of catalog was not displayed", and the screenshot is a blank white screen | The app was relaunched while its previous window was still closing. Seen once, in the final verification run, when `freshStart` cleared the data of the running app without stopping it first. Fixed by stopping the app before clearing it. If it comes back, look for the warning "restarting the app once more" in the run output |
