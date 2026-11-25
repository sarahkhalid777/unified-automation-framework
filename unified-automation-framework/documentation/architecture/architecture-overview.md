# Framework Architecture Overview

| | |
|---|---|
| **Status** | Phase 10 – complete; see the [POC acceptance checklist](../poc-acceptance-checklist.md) |
| **Scope** | Unified Web (Playwright), API (Playwright `APIRequestContext`), Database (PostgreSQL) and Mobile (Appium + WebdriverIO) automation |
| **Application under test** | ShopLite, a local e-commerce app in `../sample-app` |

This document describes the architecture and records, in the **Status** column of the module table, which phase implemented each part.

## 1. Application under test

Public demo sites (SauceDemo, Advantage Online Shopping) were evaluated. They are fine for UI automation, but none of them lets a test suite query their database. Requirement 9 of the POC (API → UI → database consistency) can't be demonstrated honestly against them. So the POC targets **ShopLite**, a small app hosted locally and built for this purpose:

- Node.js + Express REST API: customers, authentication (JWT), products and search, cart, checkout, orders
- PostgreSQL 6-table schema: `customers`, `products`, `carts`, `cart_items`, `orders`, `order_items`
- Server-rendered HTML pages with stable `data-testid` hooks
- Structured JSON application log (`sample-app/logs/app.log`) for log analysis

ShopLite lives in a **sibling folder** and the framework has no code dependency on it. The framework only knows ShopLite's URLs and database name through configuration. The application-specific parts (page objects, API clients, SQL queries) are kept in clearly named modules, so pointing the framework at another application means replacing those modules, not the core.

## 2. Layered design

```
┌───────────────────────────────────────────────────────────────────────────┐
│ tests/              web · api · integration · mobile · framework (self)   │  what is verified
├───────────────────────────────────────────────────────────────────────────┤
│ src/fixtures/       Playwright fixtures: dependency injection of the      │  wiring
│                     services below into each test, with automatic cleanup │
├───────────────────────────────────────────────────────────────────────────┤
│ src/app/<name>/     application-specific: pages, API clients, SQL repos,  │  knows ShopLite
│                     business flows (e.g. "checkout")                      │
├───────────────────────────────────────────────────────────────────────────┤
│ src/data/           builders, value objects, test-data factories          │  domain data
├───────────────────────────────────────────────────────────────────────────┤
│ src/api · src/database · src/browser · src/mobile · src/reporting         │  generic engines
│ src/config · src/logging · src/core                                       │  (reusable as-is)
└───────────────────────────────────────────────────────────────────────────┘
```

Dependencies point **downwards only**. Generic layers never import from `src/app`, so they can be reused for another application without changes.

## 3. Folder structure and module responsibilities

| Path | Responsibility | Status |
|---|---|---|
| `src/core/` | Framework error types, the condition-based wait helper (`pollUntil`), and `CleanupRegistry` (test data undo steps, run in reverse order after each test) | **Implemented (P1, P3)** |
| `src/config/` | Typed, validated configuration from environment variables; the environment Strategy (local / ci); database config validated lazily | **Implemented (P1)** |
| `src/logging/` | Structured logger whose output is always redacted (passwords, tokens, auth headers, JWTs, connection strings), with pluggable sinks | **Implemented (P1)** |
| `src/api/` | `ApiClient`: GET/POST/PUT/PATCH/DELETE, auth strategies, a correlation ID on every request, one retry of idempotent calls on connection reset, redacted record of each request/response. `ApiClientFactory` builds configured clients. `SchemaValidator` (Ajv, cached). Knows nothing about ShopLite | **Implemented (P3)** |
| `src/database/` | `DatabaseClient`: parameterised `query` / `one` / `maybeOne` / `execute`, `transaction` (commit or full rollback), `withRollback` (always rolls back, for probing constraints), BIGINT parsed to number. `shared-database.ts`: one pool per worker | **Implemented (P4)** |
| `src/browser/` | `BrowserDiagnostics`: records console errors, uncaught page errors, failed requests and HTTP 4xx/5xx responses (redacted). Attached to failed tests; an uncaught page error fails the test | **Implemented (P2)** |
| `src/data/` | Generic builders (`CustomerBuilder`, `ShippingAddressBuilder`, `ProductBuilder`) and value objects (`Money`, `Email`, `Brand`) | **Implemented (P2–P6)** |
| `src/app/shoplite/` | Page objects; `api/ShopLiteEndpoints` (one class per resource, raw responses); `api/schemas/*.json` (response contracts); `ShopLiteApi` (arranging state); `database/shoplite-database.ts` (customer, product, cart and order repositories - all SQL lives here); `flows/ShopperFlow` (log in, search, add to cart, check out as business steps); `data/OrderBuilder` + `OrderPlan`; `value-objects/OrderNumber`; `ids.ts` (branded IDs); `order-snapshot.ts` (one order shape built from the UI, the API or the database, so the three compare with one equality check); catalogue helpers; business rules | **Implemented (P2–P5)** |
| `src/fixtures/` | `base.fixtures.ts`: the test's trace ID (request ID prefix, application-log capture) and report labels. `api.fixtures.ts` extends it: API endpoints, cleanup registry, a throw-away customer per test, `toHaveStatus` / `toMatchSchema` matchers, API request log attached on failure. `web.fixtures.ts` extends that with page objects, `signedInTest`, browser diagnostics and the trace ID on browser requests | **Implemented (P1–P7)** |
| `src/reporting/` | Test ID, layer, area and severity derived from the title and tags; `RunSummaryReporter` (per-run `summary.json`, failure evidence kept across runs). `src/logging/app-log.ts` reads ShopLite's log for one test. See [reporting and logs](../framework-guide/reporting-and-logs.md) | **Implemented (P7)** |
| `src/mobile/` | Mobile config, Appium capabilities factory, locator strategies, actions and waits, failure evidence (screenshot, view hierarchy, logcat). `src/app/mydemoapp/` holds the demo app's screen objects. See [mobile testing](../framework-guide/mobile-testing.md) | **Implemented (P8)**, Android only |
| `tests/framework/` | Unit tests for the framework's own utilities (no application needed) | **Implemented (P1)** |
| `tests/setup/` | `app-health`: fails the run early if the application is down. `test-data`: removes test data older than 60 minutes left by crashed runs, and tops catalogue stock up to 50 | **Implemented (P1, P4)** |
| `tests/web/` | 13 web tests (auth, catalogue, cart, checkout) run on Chromium, Firefox and WebKit | **Implemented (P2)** |
| `tests/api/` | 17 API test cases (25 runs including data-driven variants): customers, products, cart, orders - positive, negative and access control | **Implemented (P3)** |
| `tests/database/` | 11 database tests: API writes checked in PostgreSQL, password hashing, cascading deletes, constraints, checkout atomicity, transaction behaviour | **Implemented (P4)** |
| `tests/integration/` | 5 cross-layer tests on Chromium: the full API → DB → UI → API → DB purchase journey, customer lifecycle, UI orders checked through the API and in the database, cart changes kept in step across layers | **Implemented (P5)** |
| `tests/mobile/` | 8 native Android tests (launch, login, catalogue, product details, cart), run by WebdriverIO through `wdio.conf.ts` with their own `tsconfig.json` | **Implemented (P8)**, run on an Android 14 emulator |
| `documentation/` | Architecture, [test plan](../test-plan/automation-test-plan.md) and [test cases](../test-plan/test-cases.md), framework guides (setup, execution, reporting, mobile, CI/CD, troubleshooting), [acceptance checklist](../poc-acceptance-checklist.md) | **Implemented (P10)** |
| `../.github/` | GitHub Actions at the repository root: `workflows/tests.yml` (all layers, browser matrix, Android emulator job, combined Allure report) and two shared setup actions. See [CI/CD](../framework-guide/ci-cd.md) | **Implemented (P9)**, not yet run on GitHub |
| `scripts/` | `check-test-ids.mjs`: every test has an ID, and no ID is declared twice. `ci-summary.mjs`: the GitHub job summary from a run's `summary.json` | **Implemented (P7, P9)** |
| `allurerc.mjs` | Allure report: grouping, failure categories, history | **Implemented (P7)** |
| `reports/` | Generated output: HTML and Allure reports, Allure results and history, per-run summaries, traces, screenshots (git-ignored) | Generated |

Changes from the suggested layout in the brief, and why:

- **`src/app/<application>/`** collects everything that is specific to ShopLite. In the suggested layout these would be spread across the generic folders, which would make the framework hard to reuse.
- **`builders/`, `value-objects/` and `factories/` are grouped under `src/data/`**, because they all serve one purpose: creating valid test data.
- **`strategies/` is not a separate folder.** Each strategy sits next to the code it varies. The environment strategy is in `src/config/`.
- **`tests/framework/`** was added so the framework's own logic (config validation, redaction) has unit tests.
- **No top-level `test-data/` folder.** Test data is generated by builders at run time, and the JSON schemas sit with the ShopLite API code that they describe (`src/app/shoplite/api/schemas/`).
- **Empty folders are not created ahead of time.** Each folder appears in the phase that gives it real code.

## 4. Configuration

All settings come from environment variables, which are documented in `.env.example`. Locally they are loaded from a git-ignored `.env`; in CI they come from GitHub Secrets and variables. Real environment variables always override the file.

- `buildFrameworkConfig(source)` builds an immutable, validated config from any key/value source. Tests pass a plain object instead of mutating `process.env`. Invalid values fail at startup with a message that names the variable.
- `getConfig()` caches the config, so it is built once per worker process.
- **Database credentials have no defaults.** `getDatabaseConfig()` validates them only when a test needs the database, so a web-only run on a machine without credentials still works.

## 5. Execution model (Playwright projects)

| Project | Runs | Depends on |
|---|---|---|
| `framework` | `tests/framework` – framework unit tests | – |
| `app-health` | polls the health endpoint | – |
| `test-data` | stale-data sweep and stock top-up (skipped when no DB credentials are set) | `app-health` |
| `api` | `tests/api` – no browser | `test-data` |
| `database` | `tests/database` – no browser | `test-data` |
| `chromium`, `firefox`, `webkit` | `tests/web` on each engine | `test-data` |
| `integration` | `tests/integration` – API → UI → DB flows on Chromium | `test-data` |

Mobile tests run under WebdriverIO with their own configuration (`wdio.conf.ts`), because Appium sessions do not fit Playwright's test runner. They have their own `tests/mobile/tsconfig.json`, because WebdriverIO's and Mocha's globals clash with Playwright's types.

Defaults for all projects:
- `fullyParallel`
- screenshot on failure
- trace and video kept on failure
- `data-testid` as the test-id attribute

Reports are written to `reports/`: the HTML report, Allure results and history, a summary of each run with the evidence of its failures, and raw test output. [Reporting and logs](../framework-guide/reporting-and-logs.md) explains each one.

## 6. Data flow between layers (INT-E2E-001)

```
API   POST /customers ──► customer id, email ──┐
DB    SELECT customer by id ◄──────────────────┤ (row matches)
UI    log in with the same credentials ◄───────┘
UI    search ► product page ► add to cart ► checkout ──► order number (from the confirmation URL)
API   GET /orders/{order number} ──► snapshot A
DB    SELECT order + lines by order number ──► snapshot B
UI    confirmation page ──► snapshot C
      assert A = B = C = expected (computed from catalogue price × quantity + 8% tax)
```

Every value is generated at run time: the customer, the address and the product choice. The IDs and order number come from the layer that created them and are handed to the next layer. The test attaches `journey.json` with those values and the three snapshots.

## 7. Design patterns

Each pattern is used only where it solves a specific problem. The full reasoning, with examples and the patterns deliberately left out, is in [../framework-guide/design-patterns.md](../framework-guide/design-patterns.md).

| Pattern | Where | Problem it solves |
|---|---|---|
| Builder | `src/data/builders/`, `src/app/shoplite/data/order.builder.ts` | Valid, unique test data with only the relevant fields overridden; `OrderPlan` works out expected totals once instead of in every test |
| Value Object | `Money`, `Email`, `OrderNumber`, branded IDs (`CustomerId`, `ProductId`, …) | Validation, normalisation and comparison rules live with the value; IDs of different kinds can't be mixed up (checked by the compiler) |
| Factory | `ApiClientFactory`; mobile capabilities (P8) | One place decides how a configured client is built. Browsers are created by Playwright projects, so no browser factory |
| Strategy | `environment-strategies.ts`, `api/auth.ts` | Local vs CI run policy; anonymous vs bearer-token calls, with no branching in the client |
| Dependency injection | Playwright fixtures; constructor injection | Tests declare what they need and get set-up and teardown in the right order; units testable in isolation |
| Singleton (worker-scoped) | `getSharedDatabase()`, `getConfig()` | One connection pool and one validated config per worker |

## 8. Engineering rules enforced by tooling

- `tsc --noEmit` runs in strict mode, including `noUncheckedIndexedAccess`.
- ESLint with type-aware `typescript-eslint` rules:
  - an un-awaited Playwright call fails linting (`no-floating-promises`)
  - `waitForTimeout` is banned, so waits must target a condition
- Sensitive values are redacted inside the logger itself, so test code cannot bypass redaction.

## 9. Lessons from stabilising the suite

Repeated parallel runs (`--repeat-each`) on all three engines exposed the first three problems. The fourth turned up later. Each fix is in the framework, not a retry:

1. **Interacting before the page finished loading.** ShopLite pages fetch their data after the browser's load event, and checkout only attaches its submit handler after that fetch. A fast click caused a native form submit: no order was placed, and the address ended up in the URL. Page objects now define `waitUntilReady()`, and `open()` waits for it.
2. **Asserting shared, changing data exactly.** Stock goes down whenever another worker places an order. WEB-PROD-003 checks the displayed stock against values read before and after the page loads, instead of one exact number.
3. **Keep-alive connection resets** (`ECONNRESET`) between the test-side API client and Node's 5-second idle timeout. Idempotent requests (GET, HEAD, PUT, DELETE) are retried once. POST is never retried.

4. **Cleanup registered too late.** Two tests created their own customer and relied on their own final delete step. When one failed early, the customer was left behind. Rule: register cleanup immediately after creating data. Cleanup tolerates "already deleted".

Two more came up while building log capture (Phase 7):

5. **Fixture order is not a contract.** The first version read the application log in its own automatic fixture. It missed the requests the `customerAccount` fixture made before it, and clean-up's DELETE after it. Log capture now lives in the `traceId` fixture. Everything that sends a request depends on that fixture, so Playwright sets it up first and tears it down last.
6. **ShopLite only logged failed requests.** Its request logger checked `req.path` when the response finished. Inside a mounted Express router the `/api` prefix has already been removed at that point, so successful calls were skipped. Errors finish in the app-level handler, where the path is whole again, so they were still logged. Fixed in `sample-app/src/http.js` by deciding at the start of the request.

Application defects found along the way are listed in the test plan (Phase 10).
