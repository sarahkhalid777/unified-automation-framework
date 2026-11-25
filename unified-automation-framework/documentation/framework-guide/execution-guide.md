# Execution Guide

All commands run from `unified-automation-framework/`. ShopLite must be running for everything except the framework unit tests (see the [setup guide](setup-guide.md#2-start-the-application-under-test)).

---

## Quick reference

| Goal | Command |
|---|---|
| All Playwright tests (framework, API, database, 3 browsers, integration) | `npm test` |
| Smoke tests only | `npm run test:smoke` |
| Web tests on all three browsers | `npm run test:web` |
| Web tests on one browser | `npm run test:chromium` · `npm run test:firefox` · `npm run test:webkit` |
| API tests | `npm run test:api` |
| Database tests | `npm run test:database` |
| Integration (cross-layer) tests | `npm run test:integration` |
| Framework unit tests | `npm run test:framework` |
| Mobile (Android) tests | `npm run test:mobile` |
| One test by ID | `npm run test:id -- WEB-CART-002` |
| Static checks before committing | `npm run verify` |

Any Playwright option can be added after `--`, for example `npm run test:api -- --workers=1`.

---

## Projects and dependencies

Playwright runs the suite as **projects**. Asking for one project also runs its setup projects:

```
app-health ──► test-data ──► api · database · chromium · firefox · webkit · integration
framework  (independent: no application needed)
```

- **`app-health`** stops the run with one clear message if ShopLite is down. Without it you would get 100 connection errors.
- **`test-data`** removes stale test data and tops up stock.
- **Combining projects:** use `--project` more than once, for example `npx playwright test --project=api --project=database`.

Mobile tests are not a Playwright project. They run under WebdriverIO with `wdio.conf.ts`.

---

## Test IDs and tags

Every test title starts with its ID (`LAYER-AREA-NNN`), so `--grep` selects by ID:

```bash
npm run test:id -- API-ORDER-001                         # one test, every project it runs in
npx playwright test -g WEB-CART-002 --project=firefox    # one test, one browser
npx playwright test -g "API-ORDER-00[1-3]"               # a range
npx playwright test -g "WEB-AUTH-"                       # one area (grep matches anywhere in the title path)
npx playwright test --grep @smoke                        # a tag
npx playwright test --grep @cart --grep-invert @web      # cart tests except the web ones
npx wdio run wdio.conf.ts --mochaOpts.grep MOB-CART-002  # a mobile test
npx wdio run wdio.conf.ts --mochaOpts.grep @smoke        # mobile smoke tests
```

Tags in use: `@smoke`, layer tags (`@web`, `@api`, `@database`, `@integration`, `@framework`) and area tags (`@auth`, `@catalogue`, `@cart`, `@checkout`, `@customers`, `@orders`, `@e2e`).

To list tests without running them: `npx playwright test --list` (add `-g` to filter).

---

## Parallel execution

| Setting | Local | CI |
|---|---|---|
| Tests within a file | Parallel (`fullyParallel: true`) | Parallel |
| Workers | Playwright default (half the CPU cores) | 50% of cores |
| Change it | `WORKERS=4` in `.env`, or `--workers=4` | `WORKERS` variable |

Examples:

```bash
npx playwright test --project=chromium --project=firefox --project=webkit --workers=6   # three browsers at once
npx playwright test --workers=1                                                         # one at a time, for debugging
```

Every test creates its own customer, so tests don't interfere with each other at any worker count. In CI, layers and browsers also run as separate parallel jobs (see [CI/CD](ci-cd.md)).

Mobile tests run one at a time, because there is one device and one Appium session.

---

## Headed, debug and trace

```bash
npx playwright test -g WEB-CHK-001 --project=chromium --headed     # watch it
HEADED=true npm run test:chromium                                   # same, through config
npx playwright test -g WEB-CHK-001 --project=chromium --debug       # step through with the inspector
npx playwright test --ui                                            # interactive UI mode
npx playwright test --trace on -g INT-E2E-001                       # keep the trace even when it passes
npx playwright show-trace reports/test-results/<test folder>/trace.zip
```

Traces, screenshots and videos are kept automatically for failed tests.

---

## Environments

`TEST_ENV` selects the run policy. When it's unset, the policy is `ci` if the `CI` variable is set, and `local` otherwise.

| | `local` | `ci` |
|---|---|---|
| Retries | 0 | 2 |
| `test.only` | Allowed | Fails the run |
| Headless | Yes (`HEADED=true` to watch) | Always |

To run against another ShopLite instance, set `WEB_BASE_URL` and `API_BASE_URL`, and `DB_*` if the database is reachable. To reproduce CI behaviour locally:

```bash
TEST_ENV=ci npx playwright test --project=firefox
```

---

## After a run

| Output | Command / location |
|---|---|
| Playwright HTML report | `npm run report:html` |
| Allure report (web, API, database and mobile together) | `npm run report:allure`, then `npm run report:allure:open` |
| Run summary and kept evidence | `reports/runs/<timestamp>/summary.json` (path printed at the end of the run) |
| Mobile evidence | `reports/mobile/` |

[Reporting and logs](reporting-and-logs.md) explains how to read them.

---

## Typical sequences

```bash
# Before pushing
npm run verify && npm run test:smoke

# Full local regression, then the combined report
npm test && npm run test:mobile; npm run report:allure && npm run report:allure:open

# Investigate one failure
npx playwright test -g DB-ORDER-002 --workers=1 --retries=0
```
