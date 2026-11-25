# Reporting and Log Analysis

Every run produces three things, all under `reports/` (git-ignored):

| Output | Where | Use it for |
|---|---|---|
| Playwright HTML report | `reports/html/` | Debugging one failure: trace viewer, screenshots, video, attachments |
| Allure report | `reports/allure-report/` (from `reports/allure-results/`) | Reviewing a run: tests grouped by layer and area, failures sorted by cause, trend across runs |
| Run summary | `reports/runs/<timestamp>/` | A plain JSON record of every run, with the evidence of failed and flaky tests kept after the next run |

```bash
npm test                    # run; all three are written
npm run report:html         # open the Playwright report
npm run report:allure       # build the Allure report (adds this run to the history)
npm run report:allure:open  # serve it in a browser
```

---

## Test IDs

Each test title starts with its ID: `API-ORDER-001 a valid cart becomes an order`. The format is `LAYER-AREA-NNN`:

| Prefix | Layer |
|---|---|
| `WEB` | Web UI (runs on Chromium, Firefox and WebKit) |
| `API` | API |
| `DB` | Database |
| `INT` | Integration across layers |
| `FW` | Framework unit tests |
| `MOB` | Mobile |

`npm run check:test-ids` (part of `npm run verify`) fails if a test has no ID or the same ID is declared twice. Data-driven tests (for example the six variants of API-CUSTOMER-004) share one ID because they come from one declaration.

The ID is the only thing a test declares. The reports work out the rest:

| Shown in reports | Taken from | Example |
|---|---|---|
| Test ID (`testId` label, `test-id` annotation) | Title | `API-ORDER-001` |
| Layer (Allure *epic*) | ID prefix | `API` |
| Area (Allure *feature*) | Middle of the ID | `Orders` |
| Severity | Tags: `@smoke` → critical, otherwise normal | `critical` |
| Browser / project | Playwright project | `firefox` |
| Steps | `test.step(...)` in the test | INT-E2E-001's nine numbered steps |

That logic lives in `src/reporting/test-metadata.ts` and is applied by an automatic fixture in `src/fixtures/base.fixtures.ts`. Every test file gets it by importing `test` from the framework's fixtures rather than from `@playwright/test`.

### Running or finding one test by ID

```bash
npm run test:id -- API-ORDER-001                        # every project it runs in
npx playwright test -g WEB-CART-002 --project=firefox   # one browser
npx playwright test -g "API-ORDER-00[1-3]"              # a range
npx playwright test --grep @smoke                       # by tag
npx wdio run wdio.conf.ts --mochaOpts.grep MOB-CART-002  # a mobile test (WebdriverIO, not Playwright)
```

Mobile results are written to `reports/allure-results-mobile/`. `npm run report:allure` reads both results folders, so web, API, database and mobile tests appear in one report under the same labels.

- **HTML report:** type the ID in the search box.
- **Allure:** type the ID in the search box, or browse by Layer → Area.

---

## What is attached to a failed test

| Attachment | Added by | Contents |
|---|---|---|
| Screenshot, video, trace | Playwright (`playwright.config.ts`) | Kept only for failed tests |
| `api-exchanges.json` | `apiClientFactory` fixture | Every API request and response the test made, with its request ID, status and timing. Passwords, tokens and auth headers are redacted, and bodies are cut at 4,000 characters |
| `browser-diagnostics.json` | `diagnostics` fixture (web tests) | Console errors, uncaught page errors, failed requests and 4xx/5xx responses seen by the browser. Query strings are stripped |
| `app-log.jsonl` | `traceId` fixture | ShopLite's own log lines for this test's requests (see below) |
| `journey.json` | INT-E2E-001 | The values passed between layers and the order as seen by UI, API and database |

On a passing test nothing is attached, with one exception: if ShopLite logged a server error (5xx) for one of the test's requests, the log lines are attached and an `app-errors` annotation is added, even though the test passed.

---

## Following a test into the application log

Every request a test sends carries an `x-correlation-id` header, and ShopLite writes that ID on each line of its JSON log (`sample-app/logs/app.log`). The ID starts with the test ID:

```
INT-E2E-001.88df2e.1     POST /api/customers -> 201          ← API client, request 1
INT-E2E-001.88df2e.ui    POST /api/auth/login -> 200         ← the browser
INT-E2E-001.88df2e.ui    POST /api/orders -> 201
INT-E2E-001.88df2e.4     GET /api/orders/SL-20261124-DAEJGF -> 200
INT-E2E-001.88df2e.6     DELETE /api/customers/1350 -> 204   ← clean-up
```

- **`INT-E2E-001`**: the test.
- **`88df2e`**: this execution. It is random per run and per browser, and gets an `r1`, `r2` suffix on retries, so attempts don't mix.
- **`.1`, `.2`, …**: API calls made by the framework.
- **`.ui`**: requests made by the page. The browser context sends the header too.

The trace ID is shown in the Allure description, as a `trace-id` annotation in the HTML report, in `summary.json`, and in every `toHaveStatus` failure message (`correlation INT-NEG-001.ac2194.4`). To find everything ShopLite did for a test:

```bash
grep "INT-E2E-001.88df2e" ../sample-app/logs/app.log    # one execution
grep "\"API-ORDER-001\." ../sample-app/logs/app.log      # every execution of that test
```

This needs `APP_LOG_FILE` in `.env` to point at the application's log, which only works when the application runs on the same machine. If the variable is unset or the file doesn't exist, tests run normally without `app-log.jsonl`.

Log lines are read when the test's fixtures are torn down, after clean-up has run. They include requests made by fixtures during set-up (registering the test customer) and clean-up (deleting it).

---

## Allure report

`allurerc.mjs` configures the report:

- **Grouping:** Layer → Area, matching the test plan.
- **Categories:** failures are sorted by cause. The first rule that matches wins:

  | Category | Matches |
  |---|---|
  | Application unavailable | ShopLite or PostgreSQL could not be reached |
  | API contract: response does not match its schema | `toMatchSchema` failures |
  | API: unexpected status code | `toHaveStatus` failures |
  | Web: JavaScript error in the page | Uncaught errors in the page |
  | Timeouts | Playwright action or expectation timeouts, `pollUntil` timeouts |
  | Product errors / Test errors | Allure's defaults: any other assertion failure / any other exception |

- **Environment:** the environment name, base URLs, Node version and OS are on the overview page. Credentials are never included.
- **History:** `reports/history/allure-history.jsonl` gets one entry per test each time the report is generated. It powers the trend charts and the "new failure", "fixed" and "flaky" markers. Delete the file to start the history again.

`reports/allure-results/` holds one run only. It is emptied at the start of each run, because Allure would otherwise merge results from runs that tested different code.

---

## Run summaries and kept evidence

Playwright clears `reports/test-results/` at the start of every run. A failure that doesn't reproduce on the next run would otherwise leave no evidence behind. The run summary reporter (`src/reporting/run-summary.reporter.ts`) prevents that. After each run it writes:

```
reports/runs/2026-11-24T17-38-06-056Z/
  summary.json
  evidence/INT-NEG-001-integration/attempt-1/
    5-test-failed-1.png  6-video.webm  7-error-context.md
    8-api-exchanges.json  9-app-log.jsonl  10-trace.zip
```

`summary.json` lists every test with:
- ID, project and location
- outcome (`expected`, `unexpected`, `flaky`, `skipped`)
- number of attempts and duration
- trace ID
- first error, redacted
- paths of its kept evidence

The totals also count tests that **did not run** because a setup project they depend on failed. One failed health check otherwise looks like "1 failed" when no tests ran at all.

Evidence is copied only for failed and flaky tests, from every attempt that didn't pass. The 20 most recent runs are kept and older ones are removed. Change the limit with `keep` in `playwright.config.ts`.

The reporter prints the summary path at the end of the run: `Run summary: reports/runs/…/summary.json - 1 to look at`. Nothing is written when no test ran, for example with `--list`.

---

## Sensitive data

Nothing a report shows comes from an unredacted source:
- API exchanges, browser diagnostics, application-log lines and error messages pass through `src/logging/redact.ts` before being written.
- ShopLite never logs request bodies.
- The Allure environment block lists hosts and versions only.

If a new attachment is added, run its content through `redact()` too.
