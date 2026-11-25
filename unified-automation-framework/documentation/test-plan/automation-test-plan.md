# Automation Test Plan: ShopLite and My Demo App

| | |
|---|---|
| **System under test** | ShopLite web application, REST API and PostgreSQL database (`../sample-app`). Sauce Labs My Demo App 2.3.0 for Android (mobile layer) |
| **Framework** | Unified Automation Framework (this repository) |
| **Test cases** | [test-cases.md](test-cases.md): every test with its preconditions, data, steps and expected results |
| **Status** | Implemented and executed. Results are in section 9 |

---

## 1. Purpose

This plan describes what the POC automation suite tests, how, where, and when a run counts as successful. It is written for the QA engineers who will run and extend the suite, and for the reviewers deciding whether the framework is fit to adopt.

## 2. Objectives

1. Show that one framework can test a product through its **web UI, REST API, database and a native mobile app**, with shared configuration, test data, reporting and CI.
2. Prove **data consistency across layers**: an order created in one layer is identical in the other two.
3. Give each failure enough evidence to diagnose it **without re-running**: screenshots, traces, API exchanges, browser diagnostics, application log lines and device logs.
4. Keep the suite **reliable in parallel**: no shared accounts, no fixed sleeps, no order dependence between tests.

## 3. Scope

### In scope

| Area | Covered by |
|---|---|
| Authentication: login, failed login, logout, access control | WEB-AUTH, API-CUSTOMER-006, MOB-AUTH |
| Customer management: register, read, update (PUT/PATCH), delete, validation | API-CUSTOMER, DB-CUSTOMER, INT-CUSTOMER |
| Product catalogue: listing, search, filter, details, stock | WEB-PROD, API-PRODUCT, DB-PRODUCT, MOB-PROD |
| Cart: create, add, update quantity, remove, totals, stock limits | WEB-CART, API-CART, DB-CART, INT-CART, MOB-CART |
| Checkout and orders: place, confirm, history, validation, tax, stock reduction, atomicity | WEB-CHK, API-ORDER, DB-ORDER, INT-ORDER, INT-E2E |
| Database integrity: constraints, cascading deletes, transactions | DB-PRODUCT-002, DB-CART-002, DB-CUSTOMER-003, DB-INFRA-001 |
| The framework's own logic: configuration, redaction, value objects, builders, schema validation, reporting | FW-* |

### Out of scope

| Area | Reason |
|---|---|
| Performance, load and security (penetration) testing | Not part of the POC brief. The framework's API layer could be a starting point |
| Visual regression and accessibility audits | Not requested; would need a baseline and a review process |
| iOS | Agreed to limit mobile to Android. iOS needs macOS and Xcode. The capability factory is the extension point |
| ShopLite registration page UI | Registration is tested through the API, which every UI test uses to create its customer |
| My Demo App: product search, wrong-password login | The app has no search and accepts any password (see section 10) |

## 4. Test approach

### Levels and layers

| Layer | Tool | What a test proves |
|---|---|---|
| Framework (`FW`) | Playwright test runner, no browser | The framework's own building blocks behave correctly. Runs in seconds and needs no application |
| API (`API`) | Playwright `APIRequestContext` via the framework's `ApiClient` | Status codes, response bodies, JSON schemas, validation and access rules |
| Database (`DB`) | `pg` via the framework's `DatabaseClient` and ShopLite repositories | What the API reports is what is stored. Constraints and transactions hold |
| Web UI (`WEB`) | Playwright on Chromium, Firefox and WebKit | A customer can complete each task in the browser, on all three engines |
| Integration (`INT`) | Playwright (Chromium) + API + database | One business flow crosses all layers and they agree |
| Mobile (`MOB`) | WebdriverIO + Appium (UiAutomator2) on an Android emulator | The native app's main journeys work on a real Android runtime |

### Techniques

- **Positive and negative tests** for every resource. Negative tests check the exact status, error code and the fields reported, not just "an error".
- **Data-driven tests** where the inputs vary but the check doesn't: API-CUSTOMER-004 (6 invalid registrations) and API-PRODUCT-003 (4 invalid IDs).
- **Independent oracles:** expected totals are calculated by the framework (`OrderPlan`, `Money`) from catalogue prices. They are not copied from the response under test.
- **Cross-layer snapshots:** the order is read from the confirmation page, the API and the database into one shape, and compared with a single equality check (INT-E2E-001, INT-ORDER-*).
- **Boundary and state checks:** stock exactly 0, quantity 0 / 100, a checkout that fails half-way, a deleted customer's token.

### Test data

- **Generated at run time** by builders (`aCustomer()`, `aShippingAddress()`, `anOrder()`, `aProduct()`) with Faker. Emails are unique per test, so tests never share an account.
- **No hard-coded IDs.** Products are picked from the live catalogue (`pickProduct`). Customer IDs and order numbers come from the responses.
- **Cleanup:** every created customer or test product registers an undo step in the `CleanupRegistry`. The steps run in reverse order after the test, even if it failed. Deleting a customer cascades to their carts and orders.
- **Baseline:** before each run, the `test-data` setup project removes test data older than 60 minutes (left by crashed runs) and tops catalogue stock up to 50.
- **Mobile:** the demo app's own published demo users. Each test starts from cleared app data.

### Synchronisation

- No fixed sleeps anywhere in the suite.
- **Web:** Playwright's auto-waiting assertions.
- **API and database:** `pollUntil` where a value settles over time.
- **Mobile:** `waitForDisplayed` / `waitUntil` with a configurable timeout.

### Parallelism

- **Playwright:** `fullyParallel`, with the default number of workers locally and 50% of the CPUs in CI.
- **Isolation:** tests are safe in parallel because each has its own customer. Stock assertions tolerate other workers buying the same product ("at most", never "exactly", unless the test created its own product).
- **Mobile:** runs one session at a time on one device.
- **CI:** layers and browsers run as parallel jobs.

## 5. Environments

| Environment | Where | Application | Database | Mobile device |
|---|---|---|---|---|
| **Local** (`TEST_ENV=local`) | Windows 11, Node 24 | ShopLite `npm run start:local` on `localhost:3000` | PostgreSQL 19.0 started by ShopLite from npm binaries (`embedded-postgres`) | Android 14 emulator `poc-api34` (Pixel 6, x86_64, WHPX acceleration) |
| **CI** (`TEST_ENV=ci`) | GitHub Actions `ubuntu-latest`, Node 24 | ShopLite started inside each job | `postgres:19-alpine` service container per job | Android 14 emulator (Pixel 6, x86_64, KVM) |

| Component | Version |
|---|---|
| Playwright | 1.65.1: Chromium 159.0, Firefox 159.0, WebKit 27.2 |
| WebdriverIO / Appium / UiAutomator2 driver | 10.2.0 / 3.9.1 / 8.7.3 |
| TypeScript | 6.0.3 |
| Allure | 3.33 (CLI) with allure-playwright 3.15 and @wdio/allure-reporter 10.2 |
| My Demo App (Android) | 2.3.0 (build 27), SHA-256 `bd3a3d6f…6591ec8` |

The run policy differs per environment through the environment Strategy:

| | Local | CI |
|---|---|---|
| Retries | 0 | 2 |
| `test.only` | Allowed | Fails the run |
| Headless | Yes; `HEADED=true` to watch | Always |

See [setup guide](../framework-guide/setup-guide.md) and [CI/CD](../framework-guide/ci-cd.md).

## 6. Coverage against the brief

The brief listed 25 test cases. Each is covered by at least one test:

| Brief | Test ID(s) |
|---|---|
| Web: successful login | WEB-AUTH-001 |
| Web: unsuccessful login | WEB-AUTH-002, WEB-AUTH-003 |
| Web: logout | WEB-AUTH-004 |
| Web: product search | WEB-PROD-001, WEB-PROD-002 |
| Web: product details | WEB-PROD-003 |
| Web: add to cart | WEB-CART-001 |
| Web: update quantity | WEB-CART-002 |
| Web: remove a product | WEB-CART-003 |
| Web: checkout with valid details | WEB-CHK-001 (and invalid: WEB-CHK-003) |
| Web: order confirmation | WEB-CHK-002 |
| API: customer creation | API-CUSTOMER-001 |
| API: customer retrieval | API-CUSTOMER-002 |
| API: customer update | API-CUSTOMER-003 |
| API: invalid customer creation | API-CUSTOMER-004 (6 cases), API-CUSTOMER-005 |
| API: product retrieval | API-PRODUCT-001, API-PRODUCT-002, API-PRODUCT-003 |
| API: cart creation | API-CART-001 (and API-CART-002, API-CART-003) |
| API: order creation | API-ORDER-001, API-ORDER-002 |
| API: invalid order submission | API-ORDER-003, API-ORDER-004 |
| Mobile: application launch | MOB-APP-001 |
| Mobile: login | MOB-AUTH-001 (and failures: MOB-AUTH-002, MOB-AUTH-003) |
| Mobile: product search | MOB-PROD-001. The app has no search, so the product is found by scrolling the catalogue to it |
| Mobile: add to cart | MOB-CART-001, MOB-CART-002 |
| Integration: API customer creation → UI login | INT-CUSTOMER-001, INT-E2E-001 |
| Integration: UI checkout → API order validation | INT-ORDER-001, INT-E2E-001 |
| Integration: database validation after order creation | INT-ORDER-002, DB-ORDER-001, INT-E2E-001 |

Beyond the brief:
- the full nine-step API → DB → UI → API → DB journey (INT-E2E-001)
- cart synchronisation across layers (INT-CART-001)
- database constraint, cascade and transaction tests (DB-*)
- access-control tests (API-CUSTOMER-006, API-ORDER-004)
- 27 framework unit tests

### Totals

| Layer | Test IDs | Test runs per full run |
|---|---:|---:|
| Web | 13 | 39 (× 3 browsers) |
| API | 17 | 25 (data-driven variants) |
| Database | 11 | 11 |
| Integration | 5 | 5 |
| Mobile | 8 | 8 |
| Framework | 27 | 27 |
| **Total** | **81** | **115** (+ 2 setup checks per Playwright run) |

The [Execution guide](../framework-guide/execution-guide.md#test-ids-and-tags) explains how to run a test by its ID.

## 7. Entry criteria

A run may start when:

1. `npm run verify` passes: type check, lint, and every test has a unique ID.
2. ShopLite answers `GET /api/health` with 2xx. The `app-health` setup project checks this and stops the run with one clear error otherwise.
3. Database credentials are configured, for the `database` and `integration` projects and the test-data baseline.
4. For mobile: an emulator or device is visible to `adb`, the app's APK is at `ANDROID_APP_PATH`, and the UiAutomator2 driver is installed.

## 8. Exit criteria

A run is **accepted** when:

1. Every test passes. In CI a test that passed only on retry is reported as **flaky**. A flaky test is accepted for that run but must be investigated, not ignored.
2. No test is skipped except by an explicit, documented condition. Today the only one is the test-data baseline, which is skipped when no database credentials are set.
3. No test data is left behind: the database holds no customers or `TEST-` products from the run once it ends.
4. Every failure has its evidence attached (see [what is attached to a failed test](../framework-guide/reporting-and-logs.md#what-is-attached-to-a-failed-test)), and is either fixed, or raised as a defect with its test ID and trace ID.

The POC as a whole is accepted against the [acceptance checklist](../poc-acceptance-checklist.md).

## 9. Execution results

Final verification run, 2026-11-26, on the local environment:

| Suite | Command | Result |
|---|---|---|
| Static checks | `npm run verify` | Pass: 81 test IDs, 89 test declarations |
| Playwright: all projects | `npx playwright test` | 109 / 109 passed (27 framework + 25 API + 11 database + 39 web + 5 integration + 2 setup) |
| Test data left behind by that run | Row counts before and after | None: customers 1 → 1 (the seeded demo customer), `TEST-` products, orders and carts 0 → 0 |
| Mobile (Android 14 emulator), first run | `npm run test:mobile` | 5 passed, 3 did not run: the `beforeEach` that resets the app found a blank window after the relaunch |
| Mobile, after fixing `freshStart()` | `npm run test:mobile`, twice | 8 / 8 passed both times |
| Combined Allure report | `npm run report:allure` | 117 results, 117 passed (109 Playwright + 8 mobile) |

The mobile failure was a race in the test setup, not in the app's behaviour under test. `freshStart()` cleared the data of a running app and relaunched it straight away, while Android was still closing the old window. It now stops the app first, and if the catalogue doesn't appear it restarts once more with a logged warning. That fallback was not needed in either of the passing runs.

Evidence: `reports/runs/<timestamp>/summary.json`, `reports/allure-report/`, `reports/mobile/`, and the WebdriverIO spec output. Phases 2 to 9 repeated these runs many times. Each phase report recorded the counts and any failure found and fixed.

The CI workflow is configured but **has not yet run on GitHub** (see [CI/CD](../framework-guide/ci-cd.md#verification-before-the-first-run)).

## 10. Defects and findings

Found while automating. They are reported here rather than worked around silently.

### ShopLite

| # | Severity | Finding | Status | Effect on tests |
|---|---|---|---|---|
| SL-1 | Medium | **Successful API requests were missing from the application log.** Request logging read `req.path` inside routers, where Express has already stripped the mount path, so the API-request check failed for every routed request. | **Fixed** in Phase 7 (`sample-app/src/http.js` decides at request entry) | None now. Before the fix, log analysis saw only errors |
| SL-2 | High (privacy) | **Checkout can submit shipping details in the URL.** The checkout form has no `method`, and its `submit` handler is attached only after `await api('/cart')` finishes (`public/js/checkout.js`). If the customer submits before that, the browser does a native GET to `/checkout?name=…&address=…`. Personal data then lands in the browser history and in server and proxy logs. | Open | Tests wait for the order summary before submitting, as a real user would, so they are unaffected. Not covered by a test yet: a test would need to submit before the page finishes loading |
| SL-3 | Low | **Unhandled promise rejection on the catalogue page.** `public/js/products.js` calls `load()` without `await` or `.catch`. If the product request fails, the page keeps its old content with no message, and the browser logs an unhandled rejection. | Open | The framework's browser diagnostics would fail a test on this page error. Not seen in passing runs |
| SL-4 | Low | **Default 5-second keep-alive.** `src/server.js` keeps Node's default `keepAliveTimeout` (5 s). A client that reuses an idle connection just as the server closes it gets `ECONNRESET`. | Open | The framework's `ApiClient` retries idempotent requests once on a connection reset. Recommended fix: `server.keepAliveTimeout = 65_000` |

### My Demo App 2.3.0 (third-party demo app, not fixable here)

| # | Finding | Effect on tests |
|---|---|---|
| MDA-1 | Opening most catalogue products crashes the app (`ArrayIndexOutOfBoundsException` from position 6, `NullPointerException` at position 1) | Tests open only products that work, and recover from a crash before the next test |
| MDA-2 | Any password is accepted for a known user | No wrong-password test |
| MDA-3 | "Username is required" stays on screen after a username is entered | Each negative test checks only its own message |
| MDA-4 | No product search | MOB-PROD-001 finds the product by scrolling |

Details: [mobile testing](../framework-guide/mobile-testing.md#findings-in-the-demo-app-version-230).

## 11. Risks and limitations

| Risk / limitation | Impact | Mitigation |
|---|---|---|
| CI has not run on GitHub yet | The pipeline is unproven on real runners (database service, emulator boot, Pages) | Every job's commands were run locally in CI mode. First push should be watched. `actionlint` before pushing |
| Mobile tests target a third-party demo app with known crashes | A new app build could change behaviour or crash in new places | APK version pinned by checksum. Crash recovery in `freshStart()`. Findings documented |
| Android emulator start-up in CI is slow (about 5–10 min) and occasionally flaky | Longer pipelines, rare infrastructure failures | Separate, non-blocking job with a 45-minute limit. Snapshot caching is a future improvement |
| iOS not implemented | No coverage of iOS-specific behaviour | Out of scope by agreement. Capability factory and screen objects are the extension points |
| Shared catalogue stock between parallel workers | Exact stock assertions would be flaky | "At most" assertions, a stock baseline before each run, and test-only products where an exact value matters |
| Local runs depend on the machine staying awake | One mobile run took 71 minutes because the laptop went into Modern Standby | Documented in troubleshooting. CI runners don't sleep |
| ShopLite is a purpose-built sample, not a production system | Real applications will need new page objects, endpoints, schemas and repositories | Everything ShopLite-specific is in `src/app/shoplite/`, and the generic layers don't import it |
| Node 24.19 on the development machine is below WebdriverIO 10's declared minimum (24.22.1) | Only engine warnings today, but could break | CI uses the newest Node 24. Upgrade the local Node |
