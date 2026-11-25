# CI/CD (GitHub Actions)

One workflow, `.github/workflows/tests.yml` at the repository root, runs every layer. Two composite actions next to it hold the steps that several jobs share:

- `.github/actions/setup-framework`: Node.js 24 with the npm cache, then `npm ci`.
- `.github/actions/start-shoplite`: installs ShopLite, applies its schema and seed data to the job's database, starts it on port 3000 and waits for `/api/health`.

---

## When it runs

| Trigger | What runs | Notes |
|---|---|---|
| Pull request to `main` | Everything | A newer push to the same pull request cancels the older run |
| Push to `main` | Everything | Also updates the Allure history, and publishes the report if enabled |
| Schedule, weekdays 02:30 UTC | Everything | Catches breakage from new browser versions, runner images or the demo app without a code change |
| Manual (*Actions → Tests → Run workflow*) | Choose the browsers (`all` or one) and whether to run Android | For re-running one browser or skipping the slow mobile job |

---

## Jobs

```
checks ──┬── api-and-database ──┐
         ├── web (chromium) ────┤
         ├── web (firefox) ─────┼── report ── publish-report (optional)
         ├── web (webkit) ──────┤
         └── android ───────────┘
```

| Job | Runs on | What it does | Typical time |
|---|---|---|---|
| `checks` | `ubuntu-latest` | Checks the secrets exist, then type check, lint, test ID check and the 27 framework unit tests. Nothing else starts if this fails | 2 min |
| `api-and-database` | `ubuntu-latest` + PostgreSQL 19 service | Starts ShopLite, runs the `api`, `database` and `integration` projects | 4 min |
| `web` | `ubuntu-latest` + PostgreSQL 19 service, one job per browser | Starts ShopLite, installs that browser only, runs its project. `fail-fast` is off, so one failing browser doesn't stop the others | 3–4 min each |
| `android` | `ubuntu-latest` with KVM | Downloads the demo app and checks its SHA-256, installs the UiAutomator2 driver, boots an Android 14 emulator (Pixel 6) and runs `npm run test:mobile` | 12–20 min |
| `report` | `ubuntu-latest` | Runs even when tests failed. Merges the Allure results of every job and generates one report | 1 min |
| `publish-report` | `ubuntu-latest` | Deploys the report to GitHub Pages. Off unless enabled (see below) | 1 min |

The times are estimates. The workflow hasn't run on GitHub yet, so there are no measured times (see [Verification](#verification-before-the-first-run)).

Each test job gets its **own** PostgreSQL container and its own ShopLite, so jobs can't affect each other's data. The test jobs run with `TEST_ENV=ci`: headless, workers set to 50% of the CPUs, 2 retries, and `test.only` fails the run. The `github` reporter turns failures into annotations on the pull request's changed files.

---

## Secrets and variables

Set these in *Settings → Secrets and variables → Actions*.

| Name | Kind | Used for |
|---|---|---|
| `CI_DB_USER` | Secret | User of the throw-away PostgreSQL container. ShopLite and the database tests connect with it |
| `CI_DB_PASSWORD` | Secret | That user's password |
| `CI_JWT_SECRET` | Secret | ShopLite's token signing key. Any long random string |
| `PUBLISH_ALLURE_REPORT` | Variable (optional) | `true` publishes the report to GitHub Pages after runs on `main` |

- **Where they're used:** the secrets reach only the two jobs that start ShopLite, as environment variables. They are never written to a file. GitHub masks them in logs.
- **What they protect:** the database lives only as long as the job, so these values protect nothing outside it. They are still secrets, because the workflow is written so that pointing it at a real shared database only means changing their values.
- **If a secret is missing**, the first step of `checks` fails with a message that names it.
- **Pull requests from forks** don't receive secrets, so they stop at that step. That is GitHub's rule for forks, and the workflow does not try to work around it.

To create values:

```bash
openssl rand -hex 24   # CI_DB_PASSWORD
openssl rand -hex 32   # CI_JWT_SECRET
```

---

## Results and artifacts

Every run's page shows:

- **A job summary per test job:** totals, then one row per failed or flaky test with its trace ID and first error. It is written by `scripts/ci-summary.mjs` from the run's `summary.json`. If a setup check fails, it also shows how many tests did not run because of it.
- **Annotations** for failed Playwright tests.
- **Artifacts:**

| Artifact | Contents | Kept |
|---|---|---|
| `allure-report` | The combined Allure report for all layers. Download, unzip, then `npx allure open <folder>` | 30 days |
| `evidence-api-database`, `evidence-web-<browser>` | Playwright HTML report, `reports/runs/` (summary and failure evidence: screenshots, video, trace, API exchanges, app-log lines), and ShopLite's full `app.log` | 14 days |
| `evidence-android` | Appium server log, WebdriverIO logs, and the screenshot, logcat and view hierarchy of each failed mobile test | 14 days |
| `allure-results-*` | Raw results, kept only for the `report` job | 7 days |

To follow one failed test into the application log, take the trace ID from the job summary and search `app.log` in that job's evidence artifact. See [reporting and logs](reporting-and-logs.md#following-a-test-into-the-application-log).

### Allure history and GitHub Pages

- **History:** the trend charts and "flaky / new failure" markers need the history file from earlier runs. The `report` job restores it from the Actions cache, and saves it back only for runs on `main`, so pull requests don't affect the trend. If the cache expires (7 days unused), the history starts again.
- **Publishing:** set the variable `PUBLISH_ALLURE_REPORT` to `true`, and set *Settings → Pages → Source* to *GitHub Actions*. Runs on `main` then deploy the latest report.
  - On a **private** repository, Pages needs a paid GitHub plan.
  - On a **public** repository, the report is visible to anyone. It contains test names, error messages and redacted request logs, but no credentials.
- **Health-check and test-data steps:** these run once in each job that starts ShopLite. In the combined report they show as one test each, with the repeats counted as retries.

---

## Security choices

- `permissions: contents: read` for the whole workflow. Only `publish-report` gets `pages: write` and `id-token: write`, which deploying to Pages needs.
- **Pinning:** GitHub's own actions are pinned to a major version. The one third-party action (`reactivecircus/android-emulator-runner`) is pinned to a commit SHA, so a re-pointed tag can't change what runs.
- **Trigger:** the workflow uses `pull_request`, not `pull_request_target`. Code from a pull request never runs with the base repository's secrets or write token.
- **App download:** the APK is checked against a fixed SHA-256 before it is installed.
- **Locked installs:** `npm ci` installs exactly what the lockfiles say.

---

## Mobile job notes

- **Why Linux:** GitHub's Linux runners support hardware virtualisation (KVM), which the x86_64 emulator needs. The job enables it with a udev rule. The emulator runs headless with software rendering (`swiftshader_indirect`).
- **Device:** API level 34, `google_apis`, x86_64, Pixel 6 profile. That's the same as the `poc-api34` emulator the tests were developed on.
- **Speed:** the emulator boots from scratch on every run, which is most of the job's time. Caching an emulator snapshot would make it faster, but has not been added.
- **Time limit:** 45 minutes.
- **Not gating:** the job only uses `needs: checks`. A failure in it doesn't stop the web or API jobs, and their failures don't stop it.

---

## Verification before the first run

The workflow has **not been run on GitHub yet**: the code isn't in a GitHub repository. This was checked locally:

| Check | Result |
|---|---|
| The workflow and both composite actions parse as YAML | Pass, after fixing one real error: an unquoted `Web: ${{ … }}` in a `run:` line, which YAML reads as a mapping |
| Every `with:` input exists in the action's own `action.yml` at the pinned version, and required inputs are given | Pass (checked against GitHub for all 11 actions) |
| Each test job's commands, run locally with `TEST_ENV=ci` against ShopLite | `checks` 27/27, `api-and-database` 43/43, web 15/15 on each of Chromium, Firefox and WebKit (including the two setup checks) |
| `scripts/ci-summary.mjs` on a passing run and on a real failure (health check pointed at a closed port) | Correct totals, failure row, and "26 tests did not run" |
| Merging the results of all those runs into one Allure report | One report, grouped by layer |
| `npm ci` against both lockfiles | Lockfiles consistent |

Not verified until the first GitHub run:
- the PostgreSQL service container
- the ShopLite start script on Linux
- the Android job on a GitHub runner
- the cache
- Pages publishing

`actionlint` (a workflow linter) was not run: downloading its binary was blocked on this machine. Running it before the first push is recommended:

```bash
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest
```

---

## Running a CI job's steps locally

```bash
cd unified-automation-framework
TEST_ENV=ci npx playwright test --project=firefox
node scripts/ci-summary.mjs "Web: firefox"
```

`TEST_ENV=ci` turns on retries and `forbidOnly`. Set `RETRIES=0` to see failures without retries.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `checks` fails at "Check repository secrets" | A secret isn't set, or the run comes from a fork. Add the secrets named in the error |
| "ShopLite did not become healthy within 60 seconds" | The step prints ShopLite's console output below the error. Usually a database connection error (wrong secret) or a schema error |
| Every test in a job "did not run" | The `app-health` setup check failed. See the row in the job summary |
| `android` times out while booting | The runner had no KVM, or was slow to boot. Re-run the job. If it keeps happening, check the "Enable KVM" step's output |
| The Allure report has no trend | The first run on `main`, or the history cache expired |
| A web job fails on one browser only | `fail-fast` is off, so the other browsers' results are still valid. Open that browser's `evidence-web-*` artifact |
| `EBADENGINE` warnings from `@wdio/*` | WebdriverIO 10 declares Node ≥ 24.22.1. CI uses the newest Node 24, so this only appears on older local installs |
