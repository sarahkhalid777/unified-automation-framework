# Unified Automation Framework POC

A proof of concept for testing one product through its **web UI, REST API, PostgreSQL database and native mobile app** with a single automation framework: shared configuration, test data, logging, reporting and CI.

The repository holds two separate projects:

| Folder | What it is |
|---|---|
| [`sample-app/`](sample-app) | **ShopLite**, a small e-commerce application used as the system under test: registration and login, product catalogue and search, cart, checkout and order history, over a REST API backed by PostgreSQL |
| [`unified-automation-framework/`](unified-automation-framework) | The test framework: Playwright and TypeScript for web and API, `pg` for database checks, WebdriverIO and Appium for Android |
| [`.github/`](.github) | The GitHub Actions pipeline that runs every layer and publishes one Allure report |

ShopLite exists because public demo shops don't expose their database, and the POC needs to check what the UI and API actually stored. The framework doesn't import any ShopLite code. It reaches the running application through its web address, its API, its database and its log file, all set in `.env`, so it can be pointed at another application by replacing `unified-automation-framework/src/app/`.

The mobile tests use Sauce Labs' open-source **My Demo App** for Android, because ShopLite has no native app.

## What the tests cover

| Layer | Test IDs | Runs on |
|---|---|---|
| Web | 13 | Chromium, Firefox and WebKit |
| API | 17 | Playwright `APIRequestContext` |
| Database | 11 | PostgreSQL |
| Integration | 5 | API, UI and database together |
| Mobile | 8 | Android emulator |
| Framework unit tests | 27 | Node |

The main end-to-end scenario, `INT-E2E-001`, creates a customer through the API, checks the row in PostgreSQL, logs in and buys through the website, then reads the order back from the UI, the API and the database and checks that all three match an independently calculated order.

## Quick start

Requirements: Node.js 24. PostgreSQL does not need to be installed; ShopLite can run a real PostgreSQL server from npm packages.

```bash
# 1. Start the application (leave this terminal running)
cd sample-app
npm install
cp .env.example .env        # set DB_USER, DB_PASSWORD and JWT_SECRET
npm run start:local         # PostgreSQL + API + website on http://localhost:3000

# 2. Run the tests (second terminal)
cd unified-automation-framework
npm install
npx playwright install chromium firefox webkit
cp .env.example .env        # use the same DB_USER and DB_PASSWORD as above
npm run verify              # type check, lint, test ID check
npm test                    # web, API, database and integration tests
npm run report:allure && npm run report:allure:open
```

Android tests need a JDK, the Android SDK and an emulator. See the [mobile testing guide](unified-automation-framework/documentation/framework-guide/mobile-testing.md).

## ShopLite scripts

Run from `sample-app/`:

| Command | Does |
|---|---|
| `npm run start:local` | Starts the local PostgreSQL server and the application |
| `npm start` | Starts only the application, against a PostgreSQL server you already have |
| `npm run db:migrate` | Creates the tables |
| `npm run db:seed` | Loads the demo catalogue |
| `npm run db:reset` | Drops and recreates the tables, then seeds them |

## Continuous integration

[`.github/workflows/tests.yml`](.github/workflows/tests.yml) runs on pull requests and pushes to `main`, every weekday at 02:30 UTC, and on demand from the Actions tab, where you can choose the browsers and whether to include Android.

Static checks run first. The API/database/integration job, one web job per browser and the Android emulator job then run in parallel, each with its own PostgreSQL service. Their results are merged into one Allure report.

The workflow needs three repository secrets: `CI_DB_USER`, `CI_DB_PASSWORD` and `CI_JWT_SECRET`. They are only used for the temporary database and application each job creates.

## Documentation

The framework's [README](unified-automation-framework/README.md) has the full command list and project layout. The guides are in [`unified-automation-framework/documentation/`](unified-automation-framework/documentation):

- [Architecture overview](unified-automation-framework/documentation/architecture/architecture-overview.md)
- [Design patterns](unified-automation-framework/documentation/framework-guide/design-patterns.md)
- [Setup](unified-automation-framework/documentation/framework-guide/setup-guide.md) and [execution](unified-automation-framework/documentation/framework-guide/execution-guide.md)
- [Reporting and logs](unified-automation-framework/documentation/framework-guide/reporting-and-logs.md)
- [Mobile testing](unified-automation-framework/documentation/framework-guide/mobile-testing.md)
- [CI/CD](unified-automation-framework/documentation/framework-guide/ci-cd.md)
- [Troubleshooting](unified-automation-framework/documentation/framework-guide/troubleshooting.md)
- [Automation test plan](unified-automation-framework/documentation/test-plan/automation-test-plan.md) and [test cases](unified-automation-framework/documentation/test-plan/test-cases.md)
- [POC acceptance checklist](unified-automation-framework/documentation/poc-acceptance-checklist.md)

## Security

No credentials are committed. Both projects read their settings from environment variables, with a `.env.example` template listing every variable and real `.env` files git-ignored. In CI the values come from GitHub Secrets. The framework redacts passwords, tokens and authorization headers from every log, attachment and report.
