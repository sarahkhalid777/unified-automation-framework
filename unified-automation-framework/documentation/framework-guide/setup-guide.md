# Setup Guide

Step-by-step installation for a new machine. Allow about 15 minutes for Web, API and Database, plus 30–45 minutes the first time for Android (mostly downloads).

The repository holds two independent projects side by side:

```
Automation-poc/
  sample-app/                    ShopLite: the application under test (Node.js + PostgreSQL)
  unified-automation-framework/  this framework
  .github/                       CI workflow (runs both)
```

---

## 1. Prerequisites

| Tool | Version | Check | Needed for |
|---|---|---|---|
| Node.js | 24 LTS, 24.22.1 or later recommended (WebdriverIO 10 declares it) | `node --version` | Everything |
| npm | Comes with Node (11.x) | `npm --version` | Everything |
| Git | Any recent version | `git --version` | Cloning |
| Disk space | About 2 GB (browsers, PostgreSQL binaries), plus about 6 GB for Android | | |

You don't need to install a PostgreSQL server. ShopLite starts a real PostgreSQL 19 from npm binaries (`embedded-postgres`) when `DB_EMBEDDED=true`. To use an existing server instead, set `DB_EMBEDDED=false` and point the `DB_*` variables at it.

## 2. Start the application under test

```bash
cd sample-app
npm install
cp .env.example .env
```

Edit `sample-app/.env`:

| Variable | Set to |
|---|---|
| `DB_USER`, `DB_PASSWORD` | Any user name and password. With the embedded database they are created on first start |
| `JWT_SECRET` | A long random string, for example the output of `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| everything else | Leave the defaults |

```bash
npm run start:local
```

This starts PostgreSQL, applies the schema, seeds the catalogue and serves the app at **http://localhost:3000**. Leave the terminal open. Check it with:

```bash
curl http://localhost:3000/api/health     # {"status":"ok",...}
```

The application log is written to `sample-app/logs/app.log`. The framework reads it to attach application log lines to failed tests.

Useful commands:
- `npm run db:reset` re-creates the schema and seed data. **This deletes all ShopLite data.**
- `npm run db:seed` restores the catalogue only.

## 3. Install the framework

```bash
cd unified-automation-framework
npm install
npx playwright install chromium firefox webkit
cp .env.example .env
```

Edit `unified-automation-framework/.env`. Most settings have working defaults for a local ShopLite. Only the database credentials are required:

| Variable | Set to |
|---|---|
| `DB_USER`, `DB_PASSWORD` | The same values as in `sample-app/.env` |
| `APP_LOG_FILE` | Leave as `../sample-app/logs/app.log` |

Every variable is described in `.env.example`. Real environment variables override the file. Never commit `.env`: it is git-ignored.

On Linux, browsers also need system libraries: `npx playwright install --with-deps chromium firefox webkit` (requires sudo).

## 4. Verify the installation

```bash
npm run verify                                # type check, lint, test ID check
npm run test:framework                        # 27 framework unit tests (no application needed)
npx playwright test --project=app-health      # ShopLite is reachable
npm run test:smoke                            # smoke tests on every layer (about 30 s)
```

Every command should finish green. If one doesn't, see [troubleshooting](troubleshooting.md).

## 5. Android (optional)

Only needed for `npm run test:mobile`. The full requirements, with the reasons behind each, are in [mobile testing](mobile-testing.md#infrastructure-requirements). In short:

1. **Install the tools:**
   - a JDK 17 (Temurin)
   - the Android command-line tools
   - these SDK packages: `platform-tools`, `emulator`, `build-tools;34.0.0`, `platforms;android-34`, `system-images;android-34;google_apis;x86_64`
2. **Check hardware acceleration:** `emulator -accel-check` must report WHPX (Windows), KVM (Linux) or HVF (macOS).
3. **Create the emulator:** `avdmanager create avd -n poc-api34 -k "system-images;android-34;google_apis;x86_64" -d pixel_6`
4. **Download the app:** get `mda-2.3.0-27.apk` from the [My Demo App releases](https://github.com/saucelabs/my-demo-app-android/releases/tag/2.3.0). Check that its SHA-256 is `bd3a3d6f2d50e076b2701ed2cc6a0ca82157b40a7033cf5be9f5d084b6591ec8`.
5. **Fill in the mobile section of `.env`:** `ANDROID_HOME`, `JAVA_HOME`, `APPIUM_HOME`, `ANDROID_AVD`, `ANDROID_APP_PATH`, and `ANDROID_AVD_HOME` if not the default.
6. **Install the driver:** `npm run mobile:setup` installs the Appium UiAutomator2 driver into `APPIUM_HOME`.
7. **Run:** start the emulator (or let Appium start `ANDROID_AVD`), then `npm run test:mobile`.

On Windows, run `sdkmanager` and `avdmanager` arguments that contain `;` from a `.bat` file or with `--package_file`. `cmd` splits them otherwise (see [mobile troubleshooting](mobile-testing.md#troubleshooting)).

## 6. Editor

The repository has no editor settings checked in. In VS Code, the *Playwright Test for VS Code* and *ESLint* extensions pick up the project's configuration as it is.

## 7. CI

To run the suite on GitHub, push the repository and add three repository secrets: `CI_DB_USER`, `CI_DB_PASSWORD` and `CI_JWT_SECRET`. See [CI/CD](ci-cd.md#secrets-and-variables).
