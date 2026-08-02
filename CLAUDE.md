# Budget Manager — Claude session handoff

A personal budgeting web app. Solo user is `annoyingflipper@gmail.com`. PRD already holds the user's real monthly data.

Stack: React 19 + Vite 8 + TypeScript 6 + Tailwind 4 + Supabase. Tests: Vitest 4 + React Testing Library 16. All dependencies are pinned to latest as of 2026-06-01 (see **Tooling & CI**).

## Environments

| Env | Branch | Vercel URL | Supabase project ref |
|---|---|---|---|
| PRD | `main` | https://budget-manager-drab.vercel.app | `vouazcrsrdnaeivffwot` |
| QA | `staging` | https://budget-manager-qa.vercel.app | `ovnkgwnlquislfdwaifh` |
| Local dev | (any) | http://localhost:5173 | same as QA (via `.env.development.local`) |

Vercel project env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`. All three are required at build time — `src/lib/supabase.ts` and `src/auth/MFAEnroll.tsx` throw / fall back without them. Production scope and Preview scope have different values.

## Tooling & CI

- **GitHub Actions CI** (`.github/workflows/ci.yml`, added 2026-06-01): runs `typecheck → test → build` on every push and PR, Node 24, `actions/checkout@v6` + `actions/setup-node@v6`. Placeholder `VITE_SUPABASE_*` vars are injected at the job level — tests mock all Supabase calls, so the values only need to exist to satisfy the import-time guard in `src/lib/supabase.ts`. This is *in addition to* Vercel's build gate (`vercel.json` runs `npm test && npm run build`); CI gives a green check on commits/PRs independent of deploys.
- **Supabase keepalive + backups** (2026-08-01, after both projects paused): free-tier projects pause after ~7 days idle and **a paused project can't be exported**. `.github/workflows/keepalive.yml` pings QA + PRD every 3 days (needs new `PRD_SUPABASE_URL` / `PRD_SUPABASE_SERVICE_ROLE_KEY` repo secrets; reuses the existing QA ones). `npm run backup [prd|qa|all]` dumps the public schema + auth roster to the git-ignored `backups/` via `.env.backup.local`. Caveat: GitHub disables cron workflows after 60 days without a commit. Full runbook + rebuild-into-a-new-project steps in `DEPLOYMENT.md`.
- **Full framework upgrade** (2026-06-01): everything bumped to latest and verified (97/97 tests, 0 vulns, CI + QA deploy green). React 18→19, Vite 5→8, Vitest 2→4, `@vitejs/plugin-react` 4→6, TypeScript 5→6, jsdom 25→29, Tailwind 3→4. Backup tag `pre-framework-upgrade-2026-06-01` marks the last pre-upgrade commit if a rollback is ever needed.
- **Tailwind is now v4 — CSS-first config.** There is **no `tailwind.config.js`** anymore (deleted in the migration). The theme lives in a `@theme` block in `src/index.css` (custom colors still map to the runtime `--bg`/`--card`/… theme CSS vars, so light/dark + Peach/Sage/Lavender switching is preserved). PostCSS uses `@tailwindcss/postcss` (autoprefixer removed — v4 prefixes internally). `src/index.css` uses `@import 'tailwindcss'` instead of `@tailwind` directives, plus a border-color compatibility shim (v4's default border color is `currentColor`, not gray-200).
- **`vite.config.ts` imports `defineConfig` from `vitest/config`** (not `vite`). Under Vitest 4 the old `/// <reference types="vitest" />` no longer augments Vite's config type with the `test` field. Note `tsc --noEmit` (the `typecheck` script) does **not** catch a regression here — only `tsc -b` (run by `npm run build`) does, because the config files live in the `tsconfig.node.json` project.

## E2E tests (Playwright)

Added 2026-06-09 (spec `docs/superpowers/specs/2026-06-07-playwright-e2e-design.md`, plan `docs/superpowers/plans/2026-06-09-playwright-e2e.md`). Real-browser suite under `e2e/` (Page Object Model + fixtures), hitting the **real QA backend** — complements the mocked Vitest tests. Full how-to in `e2e/README.md`.

- **Commands:** `npm run e2e` (full), `e2e:ui`, `e2e:smoke` (`@smoke` grep), `e2e:report`, `e2e:typecheck` (`tsc -p tsconfig.e2e.json`), `e2e:provision` (one-time test-user setup).
- **Separate TS project:** `tsconfig.e2e.json` (standalone, NOT referenced by the root config) keeps E2E types out of `tsc -b` / the prod build. Typecheck e2e separately.
- **Auth:** a Playwright `setup` project (`e2e/support/auth.setup.ts`) reseeds baseline (service role), logs in through the real UI, clears the TOTP/AAL2 challenge with `otplib`, and saves `e2e/.auth/user.json` (git-ignored) as `storageState`. Dedicated QA test user `e2e@budget-manager.test` (created via `scripts/e2e-provision-user.ts`).
- **Secrets:** local `.env.e2e.local` (git-ignored) + 6 GitHub Actions repo secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_TOTP_SECRET`, `QA_SUPABASE_SERVICE_ROLE_KEY`). E2E uses **real** QA values (placeholders won't work, unlike the unit-test job). The service-role key is test-infra only — `e2e/support/supabaseAdmin.ts`, never imported from `src/`. **Every service-role secret is environment-prefixed** (`QA_` / `PRD_`), renamed 2026-08-01 after an unprefixed `SUPABASE_SERVICE_ROLE_KEY` was overwritten with the PRD key by mistake; the reseed wipes and rewrites the test user's rows, so a QA/PRD mix-up there is a data-loss hazard.
- **CI:** second job `e2e` in `.github/workflows/ci.yml` (parallel to `test`), `concurrency` group serializes runs against the shared test user, uploads `playwright-report/` + traces.
- **`otplib` is pinned to `^12`** (not latest) — v13 removed the `authenticator` singleton the suite uses. Test-only dep.
- **Gotchas baked into the suite:** `MFAChallenge` loads its `factorId` async → specs retry the TOTP submit until the AAL2 dashboard renders; `DashboardPage.goto()` dismisses the changelog modal (auto-shows after a version bump, intercepts clicks); the reseed resets theme prefs to light/peach so the theme spec is deterministic; console-guard allowlist in `e2e/fixtures/console-guard.fixture.ts`.
- **a11y:** the Settings axe scan runs the full `wcag2a`/`wcag2aa` ruleset (no exclusions). The light-theme `--muted` tokens were darkened (`src/themes.css`: peach `#86685b`, sage `#617550`, lavender `#7b6490`) so muted 12px text clears AA (≥4.5:1) on both `--bg` and `--card`; dark themes already passed.

## How we work

1. **Brainstorm** → spec saved at `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`.
2. **Plan** → implementation plan at `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`.
3. **Execute** → subagent-driven. One subagent per task, full context provided in the prompt (no reading the plan file from the subagent). Subagents commit + push to `staging`.
4. **QA smoke** → user verifies on the QA Vercel URL.
5. **Merge to main** → fast-forward; user authorizes the push to main explicitly because it triggers the PRD deploy.
6. **PRD smoke** → user verifies on PRD.
7. **Notion sub-page** → controller creates `vX.Y Smoke Tests` under the hub and updates the hub Versions index.

Notion hub page ID: `36bb6bed-f453-81cb-8f5a-c62e801b5cfd`. All shipped versions have their own sub-pages linked from the hub.

## Gotchas

- **`npm test` is wired to `vitest run --mode development`.** Default Vitest mode doesn't load `.env.development.local`, so `src/lib/supabase.ts` throws at module import and three test files error out. The development-mode flag fixes it locally; Vercel works regardless because Vercel injects env vars directly.
- **Subagents pushing to `staging` trip the auto-mode security classifier.** Treat it as a false positive — `staging` is the working branch for in-progress versions, established in v1.2. Either re-issue the push from the parent session or accept the subagent's local commit and push manually.
- **TOTP issuer is baked into the QR code at enroll time.** Changing `VITE_APP_URL` only affects *future* enrollments. To rebrand an existing factor: Supabase Auth → Users → (user) → Factors → unenroll → user re-enrolls on next sign-in.
- **AAL2 is required for budget reads** (RLS policies check it). If you see 401/permission-denied after sign-in, the user is at AAL1 — needs to clear the MFA challenge before any budget query works.
- **Don't create PRs.** Solo workflow. Direct push to `staging`, fast-forward merge to `main`.

## Shipped versions

- **v1.0** (2026-05-25): Auth + MFA + dashboard + CRUD. Real June data loaded.
- **v1.1** (2026-05-26): Themes (Peach/Sage/Lavender × light/dark), Settings page, BalanceHero, EmptyCategoryCard, mobile responsive.
- **v1.2** (2026-05-26): Vercel QA + PRD deployment, `staging` branch model, `DEPLOYMENT.md` runbook.
- **v1.3** (2026-05-27): TOTP issuer rename driven by `VITE_APP_URL` (authenticator labels now read `budget-manager-{qa,drab}.vercel.app: <email>` instead of `localhost:3000`), 12 new tests (44 total), session-persistence + deferred-feature docs.
- **v1.4** (2026-05-30): Month rollover + history view. `period_month date` column on `income` + `line_items` (income PK is now `(user_id, period_month)`), header switcher (`← Month YYYY →`), explicit "Start <next month>" rollover button backed by a `rollover_month(date, date)` Postgres RPC with AAL2 guard. Seed trigger no longer inserts an income row — first save lazily creates it. Existing data backfilled to `2026-06-01`. 12 new tests (56 total).
- **v1.5** (2026-05-30): Custom user-editable categories. `categories.icon` column + `Settings → Categories` editor with rename / add / delete (forced move of items via `move_and_delete_category` RPC) / drag-reorder (via `reorder_categories` RPC) / pick emoji from `EmojiPicker`. `line_items.category_id` FK flipped to `ON DELETE RESTRICT` as a defensive backstop. `src/utils/categoryIcons.ts` deleted; components read `category.icon` directly. 14 new tests (70 total).
- **v1.5.1** (2026-05-30): Polish + changelog + analytics, shipped bundled with v1.5. Mobile drag-and-drop via the `drag-drop-touch` polyfill. Optimistic refresh + top-right `Toast` on every category mutation (via App's `refreshCounter`). `LineItemRow` delete confirm lifted to `CategoryTable` (`✕`→`✓` in 24px column, one-at-a-time). `ChangelogModal` auto-shows on first sign-in after a version bump, plus a "🆕 What's new" button in Settings. `user_preferences.last_seen_changelog_version` tracks dismissal. Logo `🍑` → `💵` (Header + Login + Signup). `<Analytics />` + `<SpeedInsights />` mounted outside `AuthGate`. 7 new tests (77 total).
- **v1.6** (2026-06-01): Insights. New dedicated `src/pages/Insights.tsx` page (📊 header button, `'insights'` member of the `Page` union in `App.tsx`). Projected-vs-actual CSS bar chart (`ProjectedVsActualChart`), automatic "vs last month" actual-spend delta (`MonthDelta`, with no-prior-month fallback), and CSV export (`ExportButtons` + `src/utils/csv.ts`, RFC-4180 escaped, one row per line item). New `getExportRows()` query in `src/api/budget.ts`. Pure-frontend computation in `src/utils/insights.ts`. No schema/RLS/auth changes. Hand-rolled bars (no charting dependency). 20 new tests (97 total).
- **v1.7** (2026-06-11): Delete future months + per-category budget health. `delete_month(date)` Postgres RPC (`supabase/migrations/0016_delete_month_rpc.sql`, AAL2-guarded, rejects months `<= current_date`'s month), `deleteMonth()` in `src/api/budget.ts`, and a `🗑 Delete this month` Header button shown only when `selectedMonth > formatMonth(new Date())` (App `handleDelete` confirms, deletes, then steps back a month). Budget-health bars: `src/utils/budgetHealth.ts` (`categoryBudgetStatus` → empty/under/near/over) + `CategoryBudgetBar` mounted in `CategoryTable`, new `--warning` amber token in `src/themes.css`/`src/index.css`. 16 new Vitest tests (115 total) + 2 E2E specs (`delete-month.e2e.ts`, `budget-health.e2e.ts`).
- **v1.8** (2026-06-13): Paid dates. `paid_on date` nullable column on `line_items` (`supabase/migrations/0017_line_item_paid_on.sql`, no constraint, NULL = unpaid). `LineItem.paidOn` threaded through `getBudget`/`addLineItem`/`updateLineItem` (camelCase ↔ `paid_on`, presence-checked so explicit null un-pays). `LineItemRow` gained a 'Mark paid' (stamps `todayISO()` from `src/utils/date.ts`) / editable `<input type=date>` / clear control; new Paid column in the row + `CategoryTable` header grid (`1.4fr 80px 80px 80px 110px 24px`). `stillToPay` util (`src/utils/stillToPay.ts`, unpaid count + projected sum) feeds a new `StillToPay` summary mounted under `IncomeSummary`. New Vitest tests (date, stillToPay, StillToPay, row paid-control, API mapping) + `e2e/specs/paid-dates.e2e.ts`.
- **v1.9** (2026-08-01): Accounts + multi-currency (chunk 1 of 3). New `accounts` table (manually-maintained balances, `USD`/`EUR`/`VES`, signed so a card can be negative, **not** month-scoped) and `exchange_rates` keyed `(user_id, currency, rate_date)` storing `units_per_usd` with USD as an implicit `1` anchor — both in `supabase/migrations/0018_accounts_and_rates.sql`, RLS in the wrapped `(select auth.uid())` form. `user_preferences.base_currency` is display-only. Rate lookup (`src/utils/rates.ts`) **carries the most recent earlier row forward** — the ECB skips weekends/holidays and the BCV rate is only captured on days the app is opened — and returns `null` rather than assuming `1`, which the UI renders as "set an exchange rate". EUR from Frankfurter (ECB, key-free, range-backfillable via `fetchEcbRange`, not yet wired to a button); VES from `ve.dolarapi.com/v1/dolares/oficial` (official BCV, key-free, **no historical endpoint** — `?fecha=` is silently ignored, verified — so history is recorded forward and gaps are filled by hand in `ExchangeRatesPanel`). Both APIs send `Access-Control-Allow-Origin: *`, so fetches are client-side with no Edge Function. New 🏦 `src/pages/Accounts.tsx` + `'accounts'` in the `Page` union, `TotalAvailable` (compact dashboard card + full page footer), `AccountRow`, `ExchangeRatesPanel`. `formatMoney` now delegates to `formatCurrency` in `src/utils/currency.ts` (single formatting implementation). 46 new Vitest tests (227 total) + `e2e/specs/accounts.e2e.ts` (**serial** — accounts are global, so parallel workers on the shared test user would wipe each other's rows).
- **v1.9 chunk 2** (2026-08-02): Per-expense currency. `line_items.currency` + `line_items.rate_units_per_usd`, both nullable (`supabase/migrations/0019_line_item_currency.sql`) — `NULL` currency means "in the user's base currency", so no backfill. **Conversion happens once at the data boundary**: `getBudget` (and `getExportRows`) add `baseProjected`/`baseActual`/`rateResolved` to every `LineItem`, and *every* money total in the app sums `base*` rather than the native fields (`GrandTotals`, `BalanceHero`, `CategoryTable`, `stillToPay`, `insights`, CSV) — this was chosen over threading rates through six components. `src/utils/itemMoney.ts` owns the precedence rules: per-expense override beats the daily table; effective date is `paid_on ?? today`. **`LineItemRow` recomputes `base*` locally on every edit** (`withConversion`) — without that the row and all totals stay stale until reload, which is exactly the bug the E2E caught. Unresolvable rates fall back to the native amount and are surfaced by `UnresolvedRatesNotice` rather than silently mis-totalling. The desktop row/header grid gained a `Cur` column (`1.4fr 76px 76px 58px 76px 138px 24px`). `fetchEcbRange` is now wired to a "Backfill euro history" button (deduped against known dates). CSV gained a `Currency` column plus converted amounts, headed with the actual base currency (`Projected (USD)`) rather than the word "base". The per-expense rate strip only renders when `item.currency !== base` — for an expense already in the base currency there is nothing to convert or override. `AccountRow` is responsive (`useIsMobile`): the fixed desktop columns squeezed the name to one character on a phone, so mobile gives the name its own full-width row. 23 new Vitest tests (270 total) + `e2e/specs/expense-currency.e2e.ts`.

## Deferred (with reasons)

- **Passkey / WebAuthn MFA** — Supabase Auth doesn't ship `factorType: 'webauthn'` yet. Revisit when they do. Do NOT build custom WebAuthn or a trusted-device cookie scheme.
- **Leaked-password protection (HaveIBeenPwned)** — Pro-plan gated. Toggle lives at Auth → Providers → Email → "Password strength and leaked password protection". 30-second job once we're on Pro.
- **Settings → Security section, FactorPicker, custom trusted-device cookies** — not built. Current sign-up flow handles the only factor type we support (TOTP).
- **"Remember me" checkbox** — Supabase already persists sessions in `localStorage` with auto-refresh. A checkbox would be cosmetic. Documented in `DEPLOYMENT.md` under "Session lifetime & remember me behavior".

## Next likely brainstorms

- **v1.9 chunks 2 and 3 are specced and pending** — both land on `staging` before a single `v1.9` merge to `main`:
  - **Chunk 2, per-expense currency** (`docs/superpowers/specs/2026-08-01-accounts-multicurrency-design.md`): migration `0019` adds `line_items.currency` + `line_items.rate_units_per_usd` (both nullable; NULL = off / use that day's rate). Each expense optionally carries a currency and converts at its `paid_on` date's rate, with a per-expense manual rate override for when you transacted off the official rate. Makes `BalanceHero`/`GrandTotals`/`IncomeSummary`/`CategoryTable`/`Insights`/CSV export currency-aware — route every total through one shared helper.
  - **Chunk 3, receipt attachments** (`docs/superpowers/specs/2026-08-01-receipt-attachments-design.md`): migration `0020` adds `line_item_attachments` + a private `receipts` Storage bucket with signed URLs. **The FK cascade does not delete Storage objects** — `deleteLineItem` and the `deleteMonth` wrapper must remove objects *before* the rows, or orphaned files leak quota invisibly.
- **Later** — patterns over time (spending donut, trend chart, two-month comparison, deferred from v1.6), or budget sharing with another user. Pick one per cycle.

Each gets its own brainstorm → spec → plan → execute cycle. Don't bundle.

## Key files / locations

- Deployment runbook: `docs/superpowers/DEPLOYMENT.md` (Vercel/Supabase env layout, rollback steps, session lifetime, TOTP issuer table, deferred items).
- Supabase client: `src/lib/supabase.ts` — throws at module load if env vars missing.
- MFA enroll: `src/auth/MFAEnroll.tsx` — reads `VITE_APP_URL` for the TOTP issuer.
- Money formatting: `src/utils/money.ts` — `formatMoney` uses `Intl.NumberFormat('en-US', { currency: 'USD' })`.
- Test setup: `src/test/setup.ts` — polyfills `matchMedia` (so `useIsMobile` returns false in jsdom).
- Styling/theme: `src/index.css` — Tailwind v4 `@theme` block (no `tailwind.config.js`); custom color utilities map to the `--bg`/`--card`/… vars defined in `src/themes.css`. `postcss.config.js` uses `@tailwindcss/postcss`.
