# Unified Automation Framework

One test automation framework for a product's **web UI, REST API, PostgreSQL database and native mobile app**: shared configuration, test data, reporting, logging and CI.

The proof of concept targets **ShopLite**, a small e-commerce application in `../sample-app` (registration, catalogue and search, cart, checkout, orders). It was built for this POC so the tests can check the database as well as the UI and API. The mobile layer tests **Sauce Labs My Demo App** for Android, because ShopLite has no native app.

The framework itself knows nothing about ShopLite outside `src/app/`. To point it at another application, replace that folder. The core stays as it is.

## What it does

- **Web:** Playwright on Chromium, Firefox and WebKit, in parallel. Page objects, auto-waiting, and screenshot, trace and video kept on failure.
- **API:** a typed client over Playwright's `APIRequestContext`, with token authentication, JSON-schema validation, a request ID on every call and a redacted record of each exchange.
- **Database:** a `pg` client with parameterised queries, transactions and always-rolled-back probes. Repositories check what the API and UI wrote.
- **Cross-layer:** a customer created by the API buys through the UI. The same order is then read from the UI, the API and the database and compared in one assertion.
- **Mobile:** Appium 3 (UiAutomator2) driven by WebdriverIO 10, on an Android emulator.
- **Evidence:** one Allure report for all layers. Failed tests carry browser console errors, API exchanges, the application's own log lines (matched by trace ID) and device logs. Secrets are redacted everywhere.
- **CI:** GitHub Actions with a browser matrix, a separate Android emulator job and a combined report.

**Suite:** 81 test IDs: 13 web (run on 3 browsers), 17 API, 11 database, 5 integration, 8 mobile and 27 framework unit tests.

## Technology

| Area | Tools |
|---|---|
| Language and runtime | TypeScript 6, Node.js 24 |
| Web and API | Playwright 1.65 (Chromium, Firefox, WebKit) |
| Mobile | WebdriverIO 10, Appium 3, UiAutomator2 driver, Android emulator |
| Database | PostgreSQL 19, `pg` |
| Validation and test data | Ajv (JSON Schema), Faker |
| Reporting | Allure 3, Playwright HTML report, per-run JSON summaries |
| Quality | ESLint (typescript-eslint, type-aware), `tsc`, test ID check |
| CI | GitHub Actions |

## Prerequisites

- Node.js 24 (24.22.1 or later recommended)
- About 2 GB of disk space for browsers and the PostgreSQL binaries
- **No** separate PostgreSQL install: ShopLite runs a real PostgreSQL server from npm binaries
- For mobile only: JDK 17, Android SDK and an emulator. See [mobile testing](documentation/framework-guide/mobile-testing.md#infrastructure-requirements)

## Installation

```bash
# 1. Application under test (keep this terminal open)
cd sample-app
npm install
cp .env.example .env               # set DB_USER, DB_PASSWORD, JWT_SECRET
npm run start:local                # PostgreSQL + API + web UI on http://localhost:3000

# 2. Framework
cd unified-automation-framework
npm install
npx playwright install chromium firefox webkit
cp .env.example .env               # set DB_USER / DB_PASSWORD to the same values

# 3. Check
npm run verify                     # type check, lint, test IDs
npm run test:smoke                 # smoke tests on every layer
```

The [setup guide](documentation/framework-guide/setup-guide.md) has the full steps, including Android.

## Running tests

| Command | Runs |
|---|---|
| `npm test` | All Playwright tests: framework, API, database, web on 3 browsers, integration |
| `npm run test:smoke` | Tests tagged `@smoke` |
| `npm run test:web` / `test:chromium` / `test:firefox` / `test:webkit` | Web tests on all or one browser |
| `npm run test:api` · `test:database` · `test:integration` · `test:framework` | One layer |
| `npm run test:mobile` | Android tests (emulator required) |
| `npm run test:id -- API-ORDER-001` | One test by its ID |
| `npm run report:html` | Open the Playwright report |
| `npm run report:allure` then `report:allure:open` | Build and open the combined Allure report |

More (parallelism, headed and debug modes, environments): [execution guide](documentation/framework-guide/execution-guide.md).

## Project layout

```
src/
  core/        errors, waits, cleanup registry
  config/      validated configuration from environment variables; local/ci strategies
  logging/     redacting logger, application-log reader
  api/         generic API client, client factory, schema validator
  database/    generic PostgreSQL client and shared pool
  browser/     browser diagnostics (console, page errors, failed requests)
  mobile/      Appium capabilities factory, locators, actions, failure evidence
  data/        builders (customer, address, product) and value objects (Money, Email, Brand)
  reporting/   test metadata from IDs, run summary reporter
  fixtures/    Playwright fixtures that wire the above into tests
  app/
    shoplite/  page objects, endpoints, JSON schemas, SQL repositories, flows, order builder
    mydemoapp/ mobile screen objects and demo users
tests/
  web/ api/ database/ integration/ mobile/   the test suites
  framework/                                 unit tests of the framework itself
  setup/                                     health check and test data baseline
documentation/
scripts/       test ID check, CI job summary
```

The [architecture overview](documentation/architecture/architecture-overview.md) explains each module and the dependency rules.

## Documentation

| Document | Contents |
|---|---|
| [Architecture overview](documentation/architecture/architecture-overview.md) | Modules, responsibilities, execution model, data flow between layers |
| [Design patterns](documentation/framework-guide/design-patterns.md) | Builder, Value Object, Factory, Strategy, Dependency Injection, Singleton: where each is used and why |
| [Automation test plan](documentation/test-plan/automation-test-plan.md) | Scope, approach, environments, coverage, entry and exit criteria, risks, defects found |
| [Test cases](documentation/test-plan/test-cases.md) | Every test: preconditions, data, steps, expected results |
| [Setup guide](documentation/framework-guide/setup-guide.md) | Installation and configuration |
| [Execution guide](documentation/framework-guide/execution-guide.md) | Running all, one layer, one browser, one test ID; parallelism; debugging |
| [Reporting and logs](documentation/framework-guide/reporting-and-logs.md) | HTML and Allure reports, failure evidence, following a test into the application log |
| [Mobile testing](documentation/framework-guide/mobile-testing.md) | Android infrastructure requirements, setup, design, demo-app findings |
| [CI/CD](documentation/framework-guide/ci-cd.md) | Pipeline structure, triggers, secrets, artifacts |
| [Troubleshooting](documentation/framework-guide/troubleshooting.md) | Common errors and their fixes |
| [POC acceptance checklist](documentation/poc-acceptance-checklist.md) | Each acceptance criterion with its location, evidence and status |

## Security

- **Configuration:** comes only from environment variables (`.env` locally, GitHub Secrets in CI). `.env` is git-ignored, and `.env.example` documents every variable without real values. Database credentials have no defaults.
- **Redaction:** logs, attachments and reports pass through one redaction module, which removes passwords, tokens, authorization headers, JWTs and connection-string credentials.
- **Demo app users:** the only credentials in the code are the mobile demo app's public demo users, which the app prints on its own login screen.
