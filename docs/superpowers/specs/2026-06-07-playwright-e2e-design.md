# Playwright E2E tests — design

**Date:** 2026-06-07
**Status:** Approved (brainstorm) — pending implementation plan
**Author:** Claude (Opus 4.8) + annoyingflipper

## Purpose

Add end-to-end (E2E) browser tests with Playwright that exercise the **real** running app against the **QA Supabase** backend. These complement the existing Vitest unit/component tests, which mock all Supabase calls (`vi.mock('../lib/supabase')`). Playwright covers what the mocked tests structurally cannot: real routing, real Supabase queries, RLS + AAL2 enforcement, actual DOM rendering, theming, file downloads, and accessibility.

**Primary use:** local E2E regression run in CI on every push/PR. Smoke against deployed QA/PRD URLs is explicitly out of scope (possible later reuse of the same page objects with a different `baseURL`).

The suite is built to **senior QA-automation standards**: Page Object Model, fixtures for composition, a deliberate locator strategy, the setup-project auth pattern, parallel-safe data isolation, web-first assertions, console/network error guards, accessibility checks, tagging, and rich reporting.

## Goals / non-goals

**Goals**
- Deterministic, idempotent, **parallel-safe** E2E suite runnable locally (`npm run e2e`) and in CI.
- Cover the critical authenticated user journeys end-to-end.
- Maintainable: locators and flows live in page objects, not scattered across specs; data setup is centralized and typed.
- Never touch the real user's account or PRD data.

**Non-goals (YAGNI — deferred)**
- Smoke testing deployed QA/PRD URLs.
- Cross-browser (Firefox/WebKit) — Chromium only to start.
- Mobile-viewport project (one responsive spec at most; full matrix deferred).
- Month rollover flow (mutating + stateful; revisit once the baseline suite is stable).
- Visual-regression / screenshot diffing (high maintenance; deferred).
- CI sharding (overkill for 5 specs; the config is shard-ready for later).

## Stack

- **`@playwright/test`** (TypeScript) — matches the repo; avoids a parallel Python toolchain. (The Python `qa-playwright` skill is intentionally not used.)
- **`otplib`** — RFC-6238 TOTP code generation (auth).
- **`@axe-core/playwright`** — accessibility assertions.
- Dev/test only; nothing added to the app runtime bundle.

## Directory structure

```
e2e/
  fixtures/
    test.ts              # central `test`/`expect` — extends base with all fixtures
    pages.fixture.ts     # instantiates page objects per test
    data.fixture.ts      # per-test scoped data factory + auto-cleanup
    console-guard.fixture.ts  # fails test on console.error / pageerror / failed requests
  pages/                 # Page Objects (one per screen)
    LoginPage.ts
    MfaChallengePage.ts
    DashboardPage.ts
    SettingsPage.ts
    InsightsPage.ts
  components/             # Component Objects (reused UI fragments)
    HeaderComponent.ts
    LineItemRowComponent.ts
    CategoryTableComponent.ts
    CategoryRowComponent.ts   # Settings → Categories editor row
    ThemeSwitcherComponent.ts
    ToastComponent.ts
  support/
    totp.ts              # generateTotp(secret)
    env.ts               # typed, validated env loader (fails fast)
    supabaseAdmin.ts     # service-role client factory (test infra only)
    seed.ts              # baseline dataset + reseedTestUser()
    auth.setup.ts        # the setup project: authenticate -> storageState
  data/
    baseline.ts          # the canonical seeded dataset (single source of truth)
  specs/
    auth-gate.e2e.ts
    dashboard-crud.e2e.ts
    categories-editor.e2e.ts
    insights-export.e2e.ts
    theme-switching.e2e.ts
  README.md              # how to provision, configure, run
playwright.config.ts
tsconfig.e2e.json        # extends root, includes e2e/, separate from app build
scripts/
  e2e-provision-user.ts  # one-time test-user + TOTP provisioning
.env.e2e.local           # git-ignored local secrets
```

## Test architecture & QA best practices

### Page Object Model (POM)
- **One page object per screen** (`LoginPage`, `MfaChallengePage`, `DashboardPage`, `SettingsPage`, `InsightsPage`) and **component objects** for reused fragments (`HeaderComponent`, `LineItemRowComponent`, `CategoryRowComponent`, `ThemeSwitcherComponent`, `ToastComponent`).
- Page objects expose **locators** (as getters) and **actions** (`goto()`, `addLineItem(name, projected)`, `editActual(row, value)`, `exportThisMonth()`), plus **query helpers** that return values (`subtotalFor(category)`).
- **No assertions inside page objects.** Assertions live in specs using web-first `expect`. Page objects return state; specs decide correctness. This keeps POMs reusable and assertion intent visible per test.
- Each page object takes the Playwright `Page` (and a parent locator for components) in its constructor; composes child component objects (e.g. `DashboardPage.header`, `DashboardPage.categoryTable(name)`).
- Single responsibility: a page object models exactly one screen/region and can be understood without reading a spec.

### Fixtures (composition over inheritance)
Central `e2e/fixtures/test.ts` re-exports a `test` extended via `test.extend` so specs `import { test, expect } from '../fixtures/test'`:
- **Page-object fixtures** — `loginPage`, `dashboardPage`, `settingsPage`, `insightsPage` instantiated per test (lazy).
- **`scopedData`** — a per-test factory that creates uniquely-named entities (prefixed with a worker+test id) via the service-role client and **auto-cleans them up** in fixture teardown, even on failure. Enables parallel mutating tests without collisions.
- **`consoleGuard`** — auto-use fixture that subscribes to `page.on('console' | 'pageerror' | 'requestfailed')` and **fails the test** on an unexpected `console.error`, uncaught exception, or failed network request (allowlist for known noise). Catches regressions specs don't explicitly assert.
- Authenticated browser context comes from the **setup project** (below) via `storageState`, not a fixture.

### Locator strategy
- **Prefer user-facing, role-based locators**: `getByRole`, `getByLabel`, `getByPlaceholder`, `getByText`. These match how users (and assistive tech) find elements and resist refactors.
- **`data-testid` only where necessary** — dynamic/ambiguous/repeated elements with no stable accessible name. Configure `testIdAttribute: 'data-testid'`.
- **Small, deliberate set of app `data-testid` additions** (the only app-code changes this work requires):
  - `LineItemRow` root → `data-testid="line-item-{id}"` (target a specific row deterministically).
  - Balance hero figures → `data-testid="projected-balance"` / `data-testid="actual-balance"`.
  - Category subtotal → `data-testid="subtotal-{categoryId}"`.
  - Theme state is already exposed via `data-theme`/`data-mode` on the document element — no testid needed.
  - Insights bar container → `data-testid="chart-row-{categoryId}"`.
  These are inert attributes (no behavior/visual change) and keep selectors stable across copy/markup tweaks.
- **No XPath, no CSS-structure coupling** (e.g. `nth-child`); locators are semantic or testid-based.

### Authentication — setup project + storageState
Use Playwright's recommended **auth setup project** rather than `globalSetup`:
- `e2e/support/auth.setup.ts` is a project named `setup` matching `**/auth.setup.ts`. It: reseeds the test user's baseline (service role), signs in (`signInWithPassword`), clears the AAL2 TOTP challenge (`mfa.challenge` + `mfa.verify` with an `otplib` code), and **saves `storageState`** to `e2e/.auth/user.json` (git-ignored).
- The `chromium` project declares `dependencies: ['setup']` and `use: { storageState: 'e2e/.auth/user.json' }`. All specs start authenticated at AAL2; **no per-test login**.
- `auth-gate.e2e.ts` overrides with `storageState: { cookies: [], origins: [] }` to drive the **real** login + TOTP UI and guard the gate flow itself.

### Test data & isolation (parallel-safe)
- **Baseline (read-only specs):** the setup project reseeds the test user to a fixed dataset (`e2e/data/baseline.ts`): known categories + one known `period_month` with known projected/actual line items. Insights and theme specs assert against this baseline and **do not mutate** it.
- **Mutating specs** (`dashboard-crud`, `categories-editor`) use the `scopedData` fixture to create **uniquely-named, self-owned** entities and assert **relative deltas** ("subtotal increases by $X after add"), then clean up. They never touch baseline rows, so they're safe under `fullyParallel`.
- **Global-order caveat:** category reorder affects user-global order. The reorder assertion operates only on test-created categories and restores/cleans them; if that proves flaky under parallelism, the `categories-editor` file is marked `test.describe.configure({ mode: 'serial' })` as a contained fallback (documented, not default).
- RLS scopes everything to the test user — reseed/cleanup can never affect the real account.

### Waiting & assertions
- **Web-first assertions only** (`await expect(locator).toBeVisible()`, `toHaveText`, `toHaveAttribute`) — auto-retrying; **no `waitForTimeout`/sleeps**.
- `expect.poll` / `expect(async () => …)` for eventual backend-derived conditions.
- Rely on Playwright auto-waiting for actionability; raise `expect` timeout where a backend round-trip is involved.

### Determinism, retries, flake policy
- **CI:** `retries: 2`, `trace: 'on-first-retry'`, `video: 'retain-on-failure'`, `screenshot: 'only-on-failure'`. **Local:** `retries: 0`, no trace.
- `forbidOnly: !!process.env.CI` (a stray `.only` fails CI).
- Flaky tests are annotated (`test.fixme`/`test.slow`) with a tracking note rather than silently retried into green; the HTML report surfaces flakiness.

### Accessibility
- `@axe-core/playwright` runs a WCAG smoke (`wcag2a`/`wcag2aa` rules) on **Login, Dashboard, Insights, Settings**; the test fails on serious/critical violations (a small, reviewed allowlist for known issues). Integrated as assertions inside the relevant specs (or a dedicated `a11y` describe block).

### Tagging & selective runs
- Title tags `@smoke` / `@regression` (and `@a11y`); `npm run e2e:smoke` → `playwright test --grep @smoke`. The auth-gate + one dashboard happy-path are `@smoke`; everything else `@regression`.

### Environment config
- `e2e/support/env.ts` reads and **validates** required vars at startup (throws a clear error listing any missing), so a misconfigured run fails fast with a useful message instead of a confusing timeout.

## Auth provisioning (one-time)

`scripts/e2e-provision-user.ts` (idempotent, run manually once) using the Supabase **service-role** admin API:
1. Create the user with `email_confirm: true` and a known password (e.g. `e2e@budget-manager.test`).
2. Sign in as the user; `mfa.enroll({ factorType: 'totp' })` → capture the **secret** + otpauth URI.
3. Generate a code from the secret via `otplib`; `mfa.challenge` + `mfa.verify` to mark the factor **verified**.
4. Print the secret; operator stores it in `.env.e2e.local` and as the `E2E_TOTP_SECRET` GitHub secret.

A non-routable email domain (`@budget-manager.test`) is fine because the admin API pre-confirms the email.

## First suite (5 specs)

1. **`auth-gate.e2e.ts`** `@smoke` — unauthenticated; `LoginPage` → `MfaChallengePage` (in-test TOTP) → `DashboardPage` renders. Also asserts the wrong-code error path.
2. **`dashboard-crud.e2e.ts`** `@smoke @regression` — via `DashboardPage` + `LineItemRowComponent` + `scopedData`: edit projected/actual (save → `ToastComponent` → balance updates), add an item (subtotal delta), delete via ✕→✓ confirm (subtotal delta). Asserts deltas, not absolutes.
3. **`categories-editor.e2e.ts`** `@regression` — via `SettingsPage` + `CategoryRowComponent`: rename, add, delete (forced item move), drag-reorder, emoji pick; assert persistence after reload. Operates on self-created categories.
4. **`insights-export.e2e.ts`** `@regression` — via `InsightsPage`: bars render for baseline categories with correct over/under colors; "vs last month" delta matches baseline; **Export this month** + **Export all history** downloads (`page.waitForEvent('download')`) with expected filename + CSV header (parse first line).
5. **`theme-switching.e2e.ts`** `@regression @a11y` — via `ThemeSwitcherComponent`: toggle light/dark + cycle Peach/Sage/Lavender; assert `data-theme`/`data-mode` on `<html>` and a computed CSS custom property (e.g. `--bg`). Includes the Settings a11y axe check.

## Playwright config (`playwright.config.ts`)

- `testDir: 'e2e'`, `testMatch: '**/*.e2e.ts'` (+ the setup project glob).
- `fullyParallel: true`, `workers: process.env.CI ? 2 : undefined`.
- `use`: `baseURL: 'http://localhost:5173'`, `testIdAttribute: 'data-testid'`, trace/video/screenshot per policy, explicit `actionTimeout`/`navigationTimeout`.
- Raised `expect` timeout for backend round-trips.
- **Projects:** `setup` (`testMatch: /auth\.setup\.ts/`) and `chromium` (`dependencies: ['setup']`, `storageState`).
- **`webServer`:** `command: 'npm run dev'`, `url: 'http://localhost:5173'`, `reuseExistingServer: !process.env.CI`, env wired from `env.ts`.
- **Reporters:** `list` (local), plus in CI `html` (`open: 'never'`), `junit` (`results.xml`), and `github` (inline PR annotations). Blob reporter ready for future sharding.

## CI integration

Add a **separate `e2e` job** to `.github/workflows/ci.yml`, parallel to the existing `test` job (unit feedback stays fast):
- `actions/checkout@v6`, `actions/setup-node@v6` (Node 24, npm cache).
- `npm ci`.
- Cache + `npx playwright install --with-deps chromium`.
- `npx playwright test`.
- `actions/upload-artifact@v4` (`if: always()`) for `playwright-report/`, `test-results/` (traces/video), and `results.xml`.
- `concurrency: { group: e2e-${{ github.ref }}, cancel-in-progress: false }` to serialize runs against the shared test user.
- `env:` wired from the secrets below.

## Secrets (QA-scoped, low sensitivity — throwaway user on the QA project)

GitHub Actions secrets, mirrored in git-ignored `.env.e2e.local` for local runs:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — **real QA** values (E2E hits the real QA backend; unlike the unit-test job, placeholders won't work).
- `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` — the dedicated test user.
- `E2E_TOTP_SECRET` — captured at provisioning; feeds `otplib`.
- `SUPABASE_SERVICE_ROLE_KEY` — QA service-role key, used **only** by `auth.setup.ts` reseed + the provisioning script. Never imported into app code.

## Tooling

- `tsconfig.e2e.json` extends the root config, `include: ['e2e', 'playwright.config.ts', 'scripts']`, kept out of the app build (`tsc -b`) so E2E types never affect the production typecheck.
- ESLint: e2e files use the same config; `eslint-plugin-playwright` optional.
- `.gitignore`: `e2e/.auth/`, `playwright-report/`, `test-results/`, `.env.e2e.local`.
- `e2e/README.md`: provisioning steps, env layout, `npm run e2e` / `e2e:ui` / `e2e:smoke`, how to read traces.
- Vercel build gate unchanged (`npm test && npm run build`); E2E lives only in GitHub Actions.

## Components & boundaries

- **Page/Component objects** — encapsulate locators + actions for one screen/fragment; no assertions.
- **Fixtures** — wire page objects, scoped data, console guard into `test`; teardown handles cleanup.
- **`support/seed.ts` + `data/baseline.ts`** — single source of truth for seeded data; specs assert against this contract.
- **`support/totp.ts` / `env.ts` / `supabaseAdmin.ts`** — small, pure, independently testable utilities.
- Specs depend on fixtures + page objects + the baseline contract — never on each other.

## Risks & mitigations

- **Shared test-user collisions** across concurrent CI runs → `concurrency` group serializes the e2e job; per-test `scopedData` namespacing for in-run parallelism.
- **Reorder global-order flake** → operate only on self-created categories; `serial` fallback for that one file if needed.
- **TOTP clock skew** (30s window) → `otplib` default window; CI runners are NTP-synced.
- **Console-guard false positives** → maintained allowlist of known-benign messages.
- **Supabase signup/email settings** blocking admin user creation → admin API with `email_confirm: true`; one-time, manually verified.
- **Service-role key in CI** → QA project only, scoped to setup/seed, never in app bundle.
- **Flaky waits** → web-first assertions + auto-waiting; no fixed sleeps; retries + trace for diagnosis.

## Out of scope / future

- QA/PRD deployed-URL smoke (reuse page objects with a different `baseURL` + read-only subset).
- Cross-browser + full mobile matrix.
- Visual-regression (`toHaveScreenshot`).
- CI sharding (config is shard-ready).
- Month-rollover + changelog-modal flows.

## Open questions

None blocking. Final test-user email and the exact `data-testid` set can be confirmed during implementation; the baseline dataset is owned by `data/baseline.ts`.
