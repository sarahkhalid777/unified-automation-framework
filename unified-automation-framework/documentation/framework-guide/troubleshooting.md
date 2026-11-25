# Troubleshooting

Common problems, grouped by where they show up. The mobile and CI guides have their own, more detailed tables:
- [mobile troubleshooting](mobile-testing.md#troubleshooting)
- [CI troubleshooting](ci-cd.md#troubleshooting)

**First step for any failed test:** open its evidence. Every failed test has a screenshot, trace, API exchanges, browser diagnostics and the application's log lines for that test. Start with the run summary path printed at the end of the run, or the Allure report's *Categories* tab, which sorts failures by cause. See [reporting and logs](reporting-and-logs.md).

---

## Start-up and configuration

| Symptom | Cause | Fix |
|---|---|---|
| `Application under test is not healthy at http://localhost:3000/api/health. Start it first` and every other test "did not run" | ShopLite isn't running, or is on another port | Start it with `cd sample-app && npm run start:local`. Otherwise set `WEB_BASE_URL` / `API_BASE_URL` to where it runs |
| `Missing required environment variable DB_PASSWORD` (or `DB_USER`, `DB_NAME`) | Database credentials aren't in `unified-automation-framework/.env` | Copy them from `sample-app/.env`. Database credentials deliberately have no defaults |
| `Environment variable X must be …, got "…"` | An invalid value in `.env`, such as a URL without `http://`, or `RETRIES=two` | Correct the named variable. `.env.example` documents each one |
| `Missing required environment variable JWT_SECRET. See sample-app/.env.example.` when starting ShopLite | `sample-app/.env` is missing or incomplete | `cp .env.example .env` in `sample-app`, then set the values |
| `EADDRINUSE :::3000` when starting ShopLite | Another ShopLite (or another app) is already on port 3000 | Stop it, or set `APP_PORT` in `sample-app/.env` and `WEB_BASE_URL` in the framework's `.env` |
| `browserType.launch: Executable doesn't exist` | Playwright's browsers aren't installed for this Playwright version | `npx playwright install chromium firefox webkit` (add `--with-deps` on Linux) |
| Test data setup is skipped: `Database credentials not set; skipping test data baseline` | No `DB_*` variables are set | Fine for web-only runs. Set the credentials to run the database and integration projects |

## Test data

| Symptom | Cause | Fix |
|---|---|---|
| `Need 2 product(s) with stock >= 10, catalogue has 0` | Stock ran down: many runs without the `test-data` project, or the catalogue was deleted | Run any project that depends on `test-data` (it tops stock up to 50), or `npm run db:seed` in `sample-app` |
| Customers or `TEST-` products left in the database | A run was killed before cleanup ran | Nothing to do. The `test-data` project removes anything older than 60 minutes at the start of the next run |
| `INSUFFICIENT_STOCK` in a test that didn't expect it | Many parallel workers bought the same product, and stock dropped below 10 | Same as above. Tests pick only products with stock ≥ 10 |

## Web tests

| Symptom | Cause | Fix |
|---|---|---|
| `Uncaught errors in the page` fails a test whose assertions all passed | The page threw a JavaScript error. The framework fails the test on purpose | Open `browser-diagnostics.json` in the test's attachments. It is an application defect, or a page loaded while the server was failing |
| Timeout waiting for a locator | The page didn't reach the expected state. The element may be missing, renamed, or behind an error | Open the trace (`npx playwright show-trace …/trace.zip`) and look at the DOM snapshot and network at the failing step. Also check `app-log.jsonl` for a 5xx |
| Passes on Chromium, fails on WebKit or Firefox | A real cross-browser difference, or a timing difference | Run that test alone on that browser with `--headed` or `--debug`. Compare the traces of both browsers |
| A test passes alone but fails in the full run | Shared state. Usually catalogue stock, or data from a crashed run | Check whether the assertion depends on an exact stock value. Tests must use "at most" or a test-only product |

## API and database tests

| Symptom | Cause | Fix |
|---|---|---|
| `Expected 200 from GET … -> 500 … correlation API-ORDER-001.ab12cd.3` | The server returned an unexpected status | Search the application log for the correlation ID: `grep "API-ORDER-001.ab12cd" ../sample-app/logs/app.log`. The test's `app-log.jsonl` attachment already has those lines |
| `Body does not match https://schemas.shoplite.test/…: /items/0 must have required property 'sku'` | The response no longer matches its contract | Compare with `src/app/shoplite/api/schemas/`. Either the API broke its contract, or the schema needs updating to a deliberate change |
| `ECONNRESET` on an API call | ShopLite closes idle connections after 5 seconds (defect SL-4 in the test plan) | The client already retries idempotent requests once. If it still happens, a POST was in flight. Fixing ShopLite's `keepAliveTimeout` removes it |
| `password authentication failed for user …` | The framework's `DB_*` values don't match ShopLite's database | Use the same values as `sample-app/.env` |
| `Expected exactly one row, got 0: SELECT …` | A repository query found nothing. Usually the API call before it failed silently, or the data was cleaned up | Check the previous step's API exchange in `api-exchanges.json` |

## Reports

| Symptom | Cause | Fix |
|---|---|---|
| The Allure report shows old results, or tests from several runs | It was generated without `--clean`, or from results folders that were merged by hand | Use `npm run report:allure`, which cleans first. Each Playwright run empties `reports/allure-results` itself |
| No Allure results or run summary after a run | `--reporter` was passed on the command line. It replaces all configured reporters | Leave out `--reporter`, or list the configured reporters too |
| `app-log.jsonl` is never attached | `APP_LOG_FILE` is unset or points at a file that doesn't exist | Set it to `../sample-app/logs/app.log`. Application logs are only available when ShopLite runs on the same machine |
| Allure trend charts are empty | There is no history yet. History grows each time the report is generated | Generate the report after each run. Delete `reports/history/allure-history.jsonl` to start over |

## Static checks

| Symptom | Cause | Fix |
|---|---|---|
| `Test ID check failed: No test ID: "…"` or `… is declared in 2 places` | A new test title doesn't start with `LAYER-AREA-NNN`, or reuses an ID | Give it the next free number in its area (`npx playwright test --list -g "WEB-CART-"` shows the IDs in use) |
| Type errors only in `tests/mobile/` | The mobile tests are type-checked with `tests/mobile/tsconfig.json` (WebdriverIO and Mocha globals) | Run `npx tsc --noEmit -p tests/mobile` to see them on their own |
| ESLint `no-floating-promises` | An `await` is missing. In tests this usually means an assertion never runs | Add the `await` |

## Machine and environment

| Symptom | Cause | Fix |
|---|---|---|
| A run takes far longer than usual, with a long gap in the logs | The computer went to sleep. On Windows, the System event log shows Kernel-Power events 506/507 | Keep the machine awake during long runs (mobile in particular) |
| `npm warn EBADENGINE … @wdio/…` | WebdriverIO 10 declares Node ≥ 24.22.1 | Upgrade Node 24. It works on 24.19, but that isn't supported |
| Commands with `;` in arguments fail on Windows (`sdkmanager`, `avdmanager`) | `cmd` splits arguments at `;` | Use `--package_file` or a `.bat` file (see the mobile guide) |
