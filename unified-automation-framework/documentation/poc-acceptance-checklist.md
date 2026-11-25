# POC Acceptance Checklist

Each acceptance criterion from the POC brief (section 18), with where it is implemented, the evidence that it works, and its status. Further requirements from the brief that a reviewer is likely to check follow in a second table.

**Status values:**
- **Passed:** implemented and verified by an actual run.
- **Pending:** implemented, but not yet verified where the criterion requires it.
- **Failed:** does not work.
- **Out of scope:** left out by agreement during the POC.

**Final verification run:** 2026-11-26, on the local environment: Windows 11, Node 24, ShopLite with PostgreSQL 19, Android 14 emulator. The results below come from that run unless stated otherwise.

| Run | Result |
|---|---|
| `npm run verify` | Pass: type check, lint, 81 test IDs over 89 test declarations |
| `npx playwright test` (all projects, 8 parallel workers) | **109 / 109 passed** in 2.0 min |
| Test data left in the database by that run | None: customers 1 → 1 (the seeded demo customer), `TEST-` products 0 → 0, orders 0 → 0, carts 0 → 0 |
| `npm run test:mobile`, first run | **5 passed, 3 did not run**: `beforeEach` found a blank screen after the app was relaunched. Root cause and fix below |
| `npm run test:mobile`, two runs after the fix | **8 / 8 passed** both times (3 min 47 s and 3 min 54 s) |
| `npm run report:allure` | One report, **117 results, 117 passed** (109 Playwright + 8 mobile) |

The first mobile run failed in the fixture that resets the app before each test. The screenshot showed a blank white window, and logcat showed the previous `MainActivity` still closing while the app was being relaunched. `freshStart()` now stops the app before clearing its data. It also restarts it once more, with a logged warning, if the catalogue still doesn't appear. That fallback was not needed in either passing run.

---

## Acceptance criteria (brief, section 18)

| # | Requirement | Implementation location | Test or execution evidence | Status |
|---|---|---|---|---|
| 1 | Web automation executes on Chromium, Firefox and WebKit | `playwright.config.ts` (projects `chromium`, `firefox`, `webkit`), `tests/web/`, `src/app/shoplite/pages/` | 13 web tests × 3 browsers = 39 / 39 passed in the final run. Each browser was also run on its own in CI mode (15 / 15 each, including the 2 setup checks) | **Passed** |
| 2 | CI/CD pipeline is configured and successfully executed | `../.github/workflows/tests.yml`, `../.github/actions/`, `scripts/ci-summary.mjs`, [CI/CD guide](framework-guide/ci-cd.md) | Configured, and checked locally: the YAML parses, every action input matches the action's `action.yml`, and each job's commands pass with `TEST_ENV=ci`. **It has not run on GitHub**: the code isn't in a GitHub repository yet, and publishing needs the owner's approval | **Pending**: needs a push to GitHub and three repository secrets |
| 3 | Parallel execution is demonstrated | `fullyParallel: true` and the workers policy in `playwright.config.ts` / `src/config/environment-strategies.ts`. CI: parallel jobs and a browser matrix | The final run executed 109 tests on 8 parallel workers in 2.0 min, with no failures and no leftover data. Tests are isolated per customer. In CI, browser and layer jobs run concurrently (not yet executed, see #2) | **Passed** (locally). CI parallelism pending with #2 |
| 4 | Reporting includes Test IDs and descriptions | `src/reporting/test-metadata.ts`, the `testMetadata` fixture in `src/fixtures/base.fixtures.ts`, `wdio.conf.ts` hooks, `allurerc.mjs` | Allure results carry `testId`, layer (epic), area (feature), severity and description for web, API, database, integration and mobile tests. FW-REPORT-001 passed. The combined report (117 results) groups them by layer and area | **Passed** |
| 5 | Application log analysis is implemented | **Correlation:** `src/logging/app-log.ts`, the `traceId` fixture, and the correlation ID in `src/api/api-client.ts`. **Browser:** `src/browser/browser-diagnostics.ts`. **Mobile:** `src/mobile/mobile-evidence.ts` | FW-REPORT-002 and FW-REPORT-003 passed. In Phase 7, a deliberately failing test got all 6 of its application-log lines attached, including setup and cleanup requests. In Phase 8 a failing mobile test got screenshot, logcat and view hierarchy; the same evidence was captured for the real failure in this run. See [reporting and logs](framework-guide/reporting-and-logs.md) | **Passed** |
| 6 | PostgreSQL integration and SQL queries work | `src/database/database-client.ts`, `shared-database.ts`, `src/app/shoplite/database/shoplite-database.ts` | 11 / 11 database tests passed: SELECT, INSERT, UPDATE and DELETE through repositories; parameterised queries; transactions (DB-INFRA-001); constraints (DB-PRODUCT-002, DB-CART-002); cascades (DB-CUSTOMER-003); atomic checkout (DB-ORDER-002) | **Passed** |
| 7 | API integration supports UI data creation | `customerAccount` and `signedInTest` fixtures, `ShopLiteApi` (`registerCustomer`, `fillCart`, `addToCart`) | Every signed-in web test creates its customer, and most create their cart, through the API (WEB-CART-002/003, WEB-CHK-001/002/003). INT-CART-001 checks an API-created cart in the UI. All passed | **Passed** |
| 8 | API, UI and database data flow is demonstrated | `tests/integration/purchase-journey.spec.ts`, `src/app/shoplite/order-snapshot.ts` | INT-E2E-001 passed: the brief's 9 steps, with the UI, API and database snapshots each equal to an independently calculated expectation. Values passed between layers are attached as `journey.json`. Phase 7 traced the run through the application log. INT-ORDER-001/002 and INT-CUSTOMER-001 passed | **Passed** |
| 9 | Builder and Value Object patterns, plus other suitable patterns | [design-patterns.md](framework-guide/design-patterns.md). Builders in `src/data/builders/` and `order.builder.ts`; value objects in `src/data/value-objects/` and `order-number.ts`; Factory: `ApiClientFactory`, `createCapabilities`; Strategy: environment and auth strategies; DI: Playwright fixtures; Singleton: worker database pool | FW-DATA-001…006 and FW-VO-001…003 passed. The patterns are used by every test, not only in demonstrations | **Passed** |
| 10 | Appium mobile automation is integrated | `wdio.conf.ts`, `src/mobile/`, `src/app/mydemoapp/`, `tests/mobile/`, [mobile testing](framework-guide/mobile-testing.md) | 8 / 8 native Android tests passed on an Android 14 emulator, twice after the fix. **Android only. iOS was not implemented or run** (agreed scope) | **Passed** (Android) |
| 11 | Meaningful end-to-end test cases are implemented | `tests/integration/` (5 tests), plus multi-step web and mobile journeys | INT-E2E-001, INT-CUSTOMER-001, INT-ORDER-001, INT-ORDER-002 and INT-CART-001 passed. WEB-CHK-002 (cart → checkout → confirmation → history) and MOB-CART-002 passed | **Passed** |
| 12 | Framework guide is complete | [Architecture overview](architecture/architecture-overview.md), [design patterns](framework-guide/design-patterns.md), [setup](framework-guide/setup-guide.md), [execution](framework-guide/execution-guide.md), [reporting](framework-guide/reporting-and-logs.md), [mobile](framework-guide/mobile-testing.md), [CI/CD](framework-guide/ci-cd.md), [troubleshooting](framework-guide/troubleshooting.md), [README](../README.md) | The commands for running and selecting tests were checked by running them or with `--list`, and one wrong example (`^WEB-AUTH`) was corrected. Not run in this phase: the interactive modes (`--ui`, `--debug`, `show-trace`) and the Linux-only `--with-deps` install | **Passed** |
| 13 | Automation test plan is complete | [automation-test-plan.md](test-plan/automation-test-plan.md), [test-cases.md](test-plan/test-cases.md) | The plan covers scope, objectives, approach, environments, coverage against the brief, entry and exit criteria, results, defects, and risks and limitations. All 81 test IDs are documented with preconditions, data, steps and expected results, written from the test code | **Passed** |

**Summary:** 12 of 13 criteria Passed, and 1 Pending (#2: the CI pipeline has not been executed on GitHub). None Failed.

---

## Further requirements from the brief

| Requirement (brief section) | Implementation location | Evidence | Status |
|---|---|---|---|
| Separate application under test with registration, catalogue, search, cart, checkout, orders, REST API, PostgreSQL (§2) | `../sample-app` | Used by every web, API, database and integration test | **Passed** |
| Headed and headless execution, browser-specific runs (§5) | `HEADED` and environment strategy, `test:chromium` / `test:firefox` / `test:webkit` | FW-CONFIG-002/003. Each browser was run on its own in Phase 9 | **Passed** |
| Screenshot, trace and video on failure; automatic browser cleanup (§5) | `playwright.config.ts` `use` block; Playwright fixtures | Phase 7 negative controls kept screenshot, video and trace under `reports/runs/<ts>/evidence/` | **Passed** |
| Mobile: driver init, capabilities, emulator config, actions, locators, waits, screenshots, logging, teardown (§6) | `src/mobile/*`, `wdio.conf.ts` | 8 / 8 passed. Failure evidence captured for the real failure in this run | **Passed** |
| Mobile: iOS configuration templates (§6) | Not implemented | The owner chose Android only ("just android is fine"). The extension point is documented in the mobile guide | **Out of scope** |
| The 8 mobile scenarios (§6) | `tests/mobile/` | All 8 passed. "Search for a product" is done by scrolling the catalogue, because the demo app has no search | **Passed** (with that substitution) |
| API: CRUD, auth, headers, status, body and schema validation, negative tests, data creation and cleanup (§7) | `src/api/`, `src/app/shoplite/api/`, `CleanupRegistry` | 25 / 25 API test runs passed. Schema checks on every response | **Passed** |
| No hard-coded database credentials; `.env.example`; no committed secrets (§8) | `src/config/`, `.env.example`, `.gitignore`; GitHub Secrets in CI | FW-CONFIG-006 (no defaults). `.env` is git-ignored. Nothing has been committed yet | **Passed** |
| About 20 meaningful test cases with IDs (§11) | `tests/` | 54 business test IDs plus 27 framework unit tests. Unique IDs are enforced by `npm run check:test-ids` | **Passed** |
| Each test documented: ID, title, description, preconditions, data, steps, expected results (§11) | [test-cases.md](test-plan/test-cases.md) | All 81 IDs | **Passed** |
| Allure with test ID, description, category, browser/device, status, duration, failure details, screenshots, logs (§12) | `allurerc.mjs`, `allure-playwright`, `@wdio/allure-reporter`, fixtures | The combined report has 117 results. Failure categories were proven by a Phase 7 negative control | **Passed** |
| Filter tests by Test ID (§12) | `npm run test:id`, `-g`, `--mochaOpts.grep`, Allure search | [Execution guide](framework-guide/execution-guide.md#test-ids-and-tags). `--list` checks in Phase 10 | **Passed** |
| No passwords or tokens in logs (§13) | `src/logging/redact.ts`, used by every sink and attachment | FW-LOG-001…005 passed. Mobile passwords are typed with `sensitive` (redacted in logs) | **Passed** |
| CI: PR, main, manual, scheduled; matrix; separate mobile job; Allure; artifacts; secrets (§14) | `../.github/workflows/tests.yml` | Configured and checked locally (see #2) | **Pending** (first GitHub run) |
| Automated report publishing (§3, §14) | `report` and `publish-report` jobs (Allure artifact, and optionally GitHub Pages) | Configured, not executed | **Pending** (first GitHub run) |
| Mobile infrastructure requirements documented separately (§14) | [mobile-testing.md, infrastructure requirements](framework-guide/mobile-testing.md#infrastructure-requirements) and [CI mobile job notes](framework-guide/ci-cd.md#mobile-job-notes) | | **Passed** |
| README, architecture, test plan, setup, execution, reporting, CI/CD and troubleshooting guides (§15) | `README.md`, `documentation/` | See #12 and #13 | **Passed** |
| No fake results or placeholder implementations (§16) | | Every result in this document comes from a run made on 2026-11-26 or in an earlier phase's report. Failures are reported as they happened | **Passed** |

---

## Open items

1. **Run the CI pipeline on GitHub (#2):**
   1. Push the repository.
   2. Add the secrets `CI_DB_USER`, `CI_DB_PASSWORD` and `CI_JWT_SECRET`.
   3. Run *Actions → Tests → Run workflow*, and check the first run against the [verification list](framework-guide/ci-cd.md#verification-before-the-first-run).
   4. Optionally enable Pages (`PUBLISH_ALLURE_REPORT=true`).
2. **ShopLite defects SL-2 to SL-4** are open (see the [test plan](test-plan/automation-test-plan.md#10-defects-and-findings)). They are findings for the application, not for the framework.
3. **Upgrade Node** on the development machine to 24.22.1 or later, as WebdriverIO 10 declares.
