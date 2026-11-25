# Design Patterns in the Framework

Each pattern below was introduced because a specific problem showed up in the code, not to tick a box. For each one: where it lives, what went wrong without it, and how to use it when you extend the framework.

Page Object is used for the web UI, as you would expect, and isn't covered here.

---

## Builder

**Where:** `src/data/builders/` (`CustomerBuilder`, `ShippingAddressBuilder`, `ProductBuilder`), `src/app/shoplite/data/order.builder.ts` (`OrderBuilder`)

**Problem:** Tests need valid data that is unique on every run, but each test cares about one or two fields: an upper-case email, a postcode in lower case, a product with exactly 2 units of stock. Building whole objects inline made it hard to see which field a test was actually about. Hard-coded values collided when tests ran in parallel or against a database that already held data from earlier runs.

**How it works:** Every builder starts from valid, generated defaults (faker plus a timestamp, so emails are unique across workers and runs) and lets a test override only what it is testing:

```ts
const customer = aCustomer().withEmail(uniqueEmail().toUpperCase()).build();
const address = aShippingAddress().withName('').withPostcode('!!').build();   // invalid on purpose
const product = aProduct().withStock(2).build();
```

`OrderBuilder` goes one step further and returns an `OrderPlan`. That is the basket *plus* the amounts ShopLite should charge for it: subtotal, 8% tax and total. Before it existed, that calculation was repeated in four test files.

```ts
const plan = anOrder().withProducts(await pickProducts(shopApi, 2)).build();
await shopApi.fillCart(session, plan);
expect(order.totalCents).toBe(plan.total.cents);
```

---

## Value Object

**Where:** `src/data/value-objects/` (`Money`, `Email`, `Brand`), `src/app/shoplite/value-objects/order-number.ts` (`OrderNumber`), `src/app/shoplite/ids.ts` (`CustomerId`, `ProductId`, `CartId`, `OrderId`)

**Problem:** Money, email addresses, order numbers and IDs were all plain numbers and strings. That caused real issues:

- **Money:** prices are integer cents in the API and `$59.99` on the page. Floating-point arithmetic and formatting were repeated in tests.
- **Email:** the API stores emails lower-cased. Tests repeated `.toLowerCase()`, and a lookup that forgot it silently found nothing.
- **Order numbers:** a regular expression was copied between specs, and nothing used the date encoded in the number.
- **IDs:** a product ID could be passed where a customer ID was expected, and the code still compiled.

**How it works:** each value validates itself when created, carries its own rules, and compares by value.

| Value | What it guarantees |
|---|---|
| `Money` | Whole, non-negative cents. Arithmetic (`plus`, `times`, `percent` with the application's rounding), `parse('$1,299.50')` and `format()` |
| `Email` | Valid shape. Always normalised (trimmed, lower-case). `equals` ignores case. `CustomerRepository.findByEmail` accepts only an `Email`, so a lookup can't skip normalisation |
| `OrderNumber` | ShopLite's `SL-YYYYMMDD-XXXXXX` format, with a valid date. `placedOn` lets API-ORDER-001 check that the number's date matches `createdAt` |
| `CustomerId`, `ProductId`, … | A compile-time brand: plain numbers at run time, distinct types for the compiler |

The ID brand is checked by `tsc` itself. `tests/framework/value-objects.spec.ts` contains an `@ts-expect-error` line that passes a `ProductId` as a `CustomerId`. If the branding stopped working, that directive would become unused and the type check would fail. This was verified by temporarily switching branding off.

---

## Factory

**Where:** `src/api/api-client.factory.ts` (`ApiClientFactory`), `src/mobile/capabilities.factory.ts` (`createCapabilities`)

**Problem:** Building a working API client needs several details that are easy to get wrong:
- the base URL must end in `/`, or Playwright drops the `/api` segment
- the timeout comes from config
- the correlation header name comes from config
- every request has to be recorded for the failure report

Early fixtures repeated that set-up and got the trailing slash wrong once.

**How it works:** fixtures ask the factory for a client (`await factory.create(auth)`). The factory owns one request context per test, records every request and response, and disposes of the context at the end.

**Mobile capabilities:** Appium expects a dozen vendor-prefixed capability names (`appium:automationName`, `appium:appWaitActivity`, …) whose values depend on the platform and on whether an emulator must be started. `createCapabilities(config)` is the only code that knows those names. It also fails early, with a clear message, if the app file is missing, rather than letting Appium time out. `wdio.conf.ts` calls it, and so does nothing else. Only Android is implemented, as agreed for this POC. iOS would be one more `case` returning XCUITest capabilities.

**Not used for browsers.** The brief suggests a browser factory, but Playwright already creates and disposes of browsers from the `projects` list in `playwright.config.ts`. Each project names its engine and device. A hand-written browser factory would duplicate that and lose Playwright's isolation and tracing. Cross-browser set-up is therefore configuration, not code.

---

## Strategy

**Where:** `src/config/environment-strategies.ts` (local / CI run policy), `src/api/auth.ts` (anonymous / bearer token)

**Problem:**
- **Run policy:** retries, headless mode, worker count and "fail if `test.only` was committed" differ between a laptop and CI. Without a strategy, `if (process.env.CI)` checks end up in the config file, the fixtures and the scripts.
- **Authentication:** the same API client has to call anonymously and as different customers within one test.

**How it works:**
- `resolveEnvironmentStrategy` picks `LocalEnvironmentStrategy` or `CiEnvironmentStrategy` from `TEST_ENV`, falling back to the `CI` variable. Variables such as `HEADED`, `WORKERS` and `RETRIES` still override the strategy's defaults for a single run.
- `ApiClient` applies whatever `AuthStrategy` it was given, with no branching inside the client. `api.as(session)` returns the same endpoints with a bearer-token strategy.

To add an environment (for example a shared staging run), write one class and register it. Nothing else changes.

---

## Dependency Injection

**Where:** Playwright fixtures in `src/fixtures/api.fixtures.ts` and `src/fixtures/web.fixtures.ts`, plus constructor injection throughout (`EnvReader(source)`, `Logger(sinks)`, `ApiClient(request, settings, auth)`, page objects and flows)

**Problem:** Tests need wired-up services (API endpoints, a database connection, page objects, a throw-away customer) and each must be torn down correctly afterwards. Building them inside tests repeats set-up and gets teardown order wrong. One real example: cleanup has to run *before* the API connection closes.

**How it works:** a test lists what it needs, and Playwright builds it, injects it and tears it down in reverse order:

```ts
test('...', async ({ api, db, shopper, customerAccount, cleanup }) => { ... });
```

Fixtures are lazy: a web-only test never opens a database connection, so it doesn't need DB credentials. Constructor injection keeps units testable without fixtures. The config is built from a plain object in `tests/framework/configuration.spec.ts`, and the logger is tested with an in-memory sink.

---

## Singleton (scoped to a worker)

**Where:** `src/database/shared-database.ts` (`getSharedDatabase`), `src/config/framework-config.ts` (`getConfig`)

**Problem:** Opening a PostgreSQL connection is slow, and the server allows only a limited number. A connection per query, or per test, would be slow and could exhaust the limit when many workers run in parallel.

**How it works:** each Playwright worker process creates one connection pool on first use. A worker-scoped fixture closes it when the worker finishes. The configuration is likewise validated once per worker.

**Where it is deliberately not used:** API clients and browsers are per test, because sharing them would let one test's cookies, tokens or recorded requests leak into another.

---

## Patterns considered and left out

- **Page Object Factory:** fixtures already create one page object per test. A factory would only add indirection.
- **Screenplay:** it suits very large teams with many actors. Here, `ShopperFlow` gives readable business steps with far less machinery.
- **Repository interfaces with multiple implementations:** there is one database. The repositories are concrete classes, and an interface can be added if a second store ever appears.
