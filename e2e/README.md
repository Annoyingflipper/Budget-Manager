# E2E tests (Playwright)

Real-browser tests against the **QA Supabase** backend. Complements the mocked Vitest unit tests.

## One-time setup

1. `cp .env.e2e.local.example .env.e2e.local` and fill in QA values + service-role key.
2. `npm run e2e:provision` — creates the dedicated test user + a verified TOTP factor.
   Copy the printed `E2E_TOTP_SECRET` into `.env.e2e.local`.
3. Add all six vars as GitHub Actions repository secrets (see `.env.e2e.local.example`).

## Running

- `npm run e2e` — full suite (auto-starts the dev server).
- `npm run e2e:ui` — interactive UI mode.
- `npm run e2e:smoke` — only `@smoke`-tagged tests.
- `npm run e2e:report` — open the last HTML report.
- `npm run e2e:typecheck` — typecheck the e2e project.

## How it works

- The **`setup` project** (`support/auth.setup.ts`) reseeds the baseline (service role),
  signs in through the real UI, clears the TOTP/AAL2 challenge with `otplib`, and saves
  `e2e/.auth/user.json`. All specs reuse that authenticated state.
- **Baseline** (`data/baseline.ts`) is the canonical seeded dataset (May + June 2026).
  Read-only specs (insights, theme) assert against it. The reseed also resets theme
  preferences to light/peach for a deterministic theme spec.
- **Mutating specs** (dashboard, categories) use the `scopedData` fixture to create
  uniquely-named, self-owned entities and clean them up — safe under `fullyParallel`.
- The **console guard** fails any test on an unexpected `console.error` / `pageerror` /
  failed request (allowlist in `fixtures/console-guard.fixture.ts`).
- **MFA timing:** `MFAChallenge` loads its factor id asynchronously; specs that drive the
  real login retry the code submission until the AAL2 dashboard renders.

## Notes / gotchas

- E2E hits the **real QA backend** — placeholder env values won't work (unlike the unit-test CI job).
- The service-role key is **test infra only**; never import `support/supabaseAdmin.ts` from `src/`.
- The dashboard `goto()` dismisses the changelog modal (auto-shown after a version bump).
- Known a11y finding (deferred, axe `color-contrast` disabled on Settings): the
  "+ Add category" button is below WCAG AA contrast on the Peach/light theme.
- Reading traces: failures in CI upload `playwright-report/` + `test-results/` (traces/video).
  Locally, re-run with `--trace on` then `npm run e2e:report`.
