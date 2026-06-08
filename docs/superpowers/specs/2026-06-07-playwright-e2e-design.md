# Playwright E2E tests — design

**Date:** 2026-06-07
**Status:** Approved (brainstorm) — pending implementation plan
**Author:** Claude (Opus 4.8) + annoyingflipper

## Purpose

Add end-to-end (E2E) browser tests with Playwright that exercise the **real** running app against the **QA Supabase** backend. These complement the existing Vitest unit/component tests, which mock all Supabase calls (`vi.mock('../lib/supabase')`). Playwright covers what the mocked tests structurally cannot: real routing, real Supabase queries, RLS + AAL2 enforcement, actual DOM rendering, theming, and file downloads.

**Primary use:** local E2E regression run in CI on every push/PR. Not (for now) automated smoke against deployed QA/PRD URLs — that's a possible later addition, explicitly out of scope here.

## Goals / non-goals

**Goals**
- Deterministic, idempotent E2E suite runnable locally (`npm run e2e`) and in CI.
- Cover the critical authenticated user journeys end-to-end.
- Never touch the real user's account or PRD data.

**Non-goals (YAGNI — deferred)**
- Smoke testing deployed QA/PRD URLs.
- Cross-browser (Firefox/WebKit) — Chromium only to start.
- Mobile-viewport project.
- Month rollover flow (mutating + stateful; revisit once the baseline suite is stable).
- Visual-regression / screenshot diffing.

## Stack & layout

- **`@playwright/test`** (TypeScript) — matches the repo; avoids a parallel Python toolchain. (The Python `qa-playwright` skill is intentionally not used.)
- New files/dirs:
  - `playwright.config.ts` — config, `webServer`, `globalSetup`, Chromium project, `storageState`.
  - `e2e/` — spec files (`*.e2e.ts`) + helpers.
  - `e2e/support/` — TOTP helper, seed helper, auth helper.
  - `scripts/e2e-provision-user.ts` — one-time test-user + TOTP provisioning.
  - `.env.e2e.local` (git-ignored) — local secrets.
- `package.json` scripts: `e2e` (`playwright test`), `e2e:ui` (`playwright test --ui`).
- Playwright `webServer` auto-starts `npm run dev` and waits for `http://localhost:5173`. The dev server reads QA Supabase creds from env (same as today).
- **Chromium only** initially.

## Auth strategy (the crux)

Login is email/password (`signInWithPassword`) followed by an **AAL2 TOTP challenge** (`src/auth/MFAChallenge.tsx`). `AuthGate` blocks all budget data until `currentLevel === 'aal2'`. So tests must clear TOTP.

**Approach: dedicated QA test user with a known TOTP secret.**

- A disposable user, e.g. `e2e@budget-manager.test`, exists **only in the QA Supabase project** with a verified TOTP factor whose **shared secret we captured at enrollment**.
- TOTP codes are generated in-test from that secret via **`otplib`** (RFC-6238), exactly as a real authenticator app would.

**One-time provisioning** — `scripts/e2e-provision-user.ts` (run manually once, re-runnable/idempotent), using the Supabase **service-role** admin API:
1. Create the user with email pre-confirmed (admin API), set a known password.
2. Sign in as the user; call `supabase.auth.mfa.enroll({ factorType: 'totp' })` → returns the **secret** + otpauth URI.
3. Generate a code from the secret with `otplib`; `mfa.challenge` + `mfa.verify` to mark the factor **verified**.
4. Print the secret (operator copies it into `.env.e2e.local` and GitHub secrets as `E2E_TOTP_SECRET`).

**Per-run auth** — Playwright **`globalSetup`**:
1. `signInWithPassword(email, password)`.
2. `mfa.challenge` + `mfa.verify` with an `otplib`-generated code → session reaches AAL2.
3. Persist the authenticated session to a Playwright **`storageState`** file (the Supabase session lives in `localStorage`).
4. All specs load with `storageState` → already past the gate, no per-test login.

One spec (`auth-gate.e2e.ts`) deliberately drives the **real login + TOTP UI** (no `storageState`) to guard the gate flow itself.

## Test-data isolation & determinism

- `globalSetup` **reseeds the test user's budget to a fixed baseline** before the run, via the service-role key: delete the test user's `income` + `line_items` (+ `categories` if needed), then insert a known set — fixed categories and one known `period_month` of line items with known projected/actual values.
- RLS scopes all reads/writes to the test user, so reseeding can never affect the real account.
- Mutating specs either clean up the rows they create or assert **relative deltas** (e.g. "subtotal increases by $X after adding an item"), so the suite is idempotent across re-runs even if a teardown is skipped.
- The known baseline month is what the dashboard/insights specs assert against.

## First suite (5 specs)

1. **`auth-gate.e2e.ts`** — from a clean state, enter email/password, then an in-test-generated TOTP code; assert the dashboard renders (hero + categories). Guards the real auth flow.
2. **`dashboard-crud.e2e.ts`** — edit a line item's projected/actual (save → toast → totals update); add an item (subtotal increases); delete an item via the ✕→✓ confirm (subtotal decreases). Assert balance/subtotal deltas.
3. **`categories-editor.e2e.ts`** — in Settings → Categories: rename a category, add one, delete one (forced item move), drag-reorder, pick an emoji. Assert persisted changes after reload.
4. **`insights-export.e2e.ts`** — open 📊 Insights: bars render for seeded categories with correct over/under colors; "vs last month" delta shows expected values for the baseline; **Export this month** and **Export all history** trigger downloads with the expected filename + CSV header row.
5. **`theme-switching.e2e.ts`** — toggle light/dark and cycle Peach/Sage/Lavender; assert `data-theme` / `data-mode` attributes and a computed CSS color (e.g. `--bg`) change accordingly.

## CI integration

- Add a **separate `e2e` job** to `.github/workflows/ci.yml`, running in parallel with the existing `test` job (so unit-test feedback stays fast):
  - `actions/checkout@v6`, `actions/setup-node@v6` (Node 24, npm cache).
  - `npm ci`.
  - `npx playwright install --with-deps chromium`.
  - `npx playwright test`.
  - Upload the Playwright **HTML report + traces** as an artifact (`actions/upload-artifact`), `if: always()`.
- **Trace/report:** `trace: 'on-first-retry'`, HTML reporter, 1 retry in CI.
- **Concurrency:** a `concurrency` group on the e2e job so two pushes can't run against the shared test user simultaneously (serialize). Low-risk for a solo dev but cheap insurance.

### Secrets (QA-scoped, low sensitivity — throwaway user on the QA project)

GitHub Actions secrets (mirrored in git-ignored `.env.e2e.local` for local runs):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — **real QA** values (E2E hits the real QA backend; unlike the unit-test job, placeholders won't work).
- `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` — the dedicated test user.
- `E2E_TOTP_SECRET` — captured at provisioning; feeds `otplib`.
- `SUPABASE_SERVICE_ROLE_KEY` — QA project service-role key, used **only** by `globalSetup` reseed + the provisioning script. Never imported into app code.

## Components & boundaries

- `e2e/support/totp.ts` — `generateTotp(secret): string` wrapping `otplib`. Pure, unit-testable.
- `e2e/support/seed.ts` — `reseedTestUser(serviceRoleClient)`; owns the baseline dataset definition. Single source of truth for what specs assert.
- `e2e/support/auth.ts` — `authenticate()` used by `globalSetup` (password + TOTP → storageState).
- `playwright.config.ts` — wires `webServer`, `globalSetup`, `storageState`, project, reporters.
- Specs depend only on the helpers + the baseline contract in `seed.ts`, not on each other.

## Risks & mitigations

- **Shared test-user collisions** across concurrent CI runs → `concurrency` group serializes the e2e job.
- **TOTP clock skew** (30s window) → `otplib` default window; CI runners are NTP-synced. Acceptable.
- **Supabase email-confirmation / signup settings** could block admin user creation → use the admin API with `email_confirm: true`; provisioning is one-time and verified manually.
- **Flaky waits** → rely on Playwright auto-waiting + role/text locators; no fixed sleeps.
- **Service-role key in CI** → QA project only, scoped to setup/seed, never in app bundle. Documented as such.

## Out of scope / future

- QA/PRD deployed-URL smoke automation (could reuse the specs with a different `baseURL` + read-only subset).
- Cross-browser + mobile projects.
- Month-rollover and changelog-modal flows.
- Wiring E2E into the Vercel build gate (kept in GitHub Actions only; Vercel keeps `npm test && npm run build`).

## Open questions

None blocking. Test-user email domain (`@budget-manager.test` vs a real inbox) can be finalized at provisioning — a non-routable domain is fine because admin API pre-confirms the email.
