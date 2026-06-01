# Budget Manager

```
            ______________________________________________
           /                                              \
          |   __________________________________________   |
          |  | $$  $1   $5   $20   $50   $100   $500  $$ |  |
          |  |__________________________________________|  |
          |  | $$  $1   $5   $20   $50   $100   $500  $$ |  |
          |  |__________________________________________|  |
          |   __________________________________________   |
          |  |                                          |  |
          |  |   [$]   B U D G E T   M A N A G E R      |  |
          |  |__________________________________________|  |
           \______________________________________________/

                 « Take control of your finances »
```

A personal budgeting web app that tracks **projected vs. actual** income and expenses
across your own customizable categories, with email/password + TOTP MFA auth. Themeable
(Peach, Sage, Lavender) with light + dark modes, month-by-month history, and an Insights
view with charts and CSV export. Built on React + Vite + Tailwind + Supabase and deployed
to Vercel.

## Features

- **Secure auth** — email + password + TOTP MFA. Budget data stays unreachable until the session reaches AAL2 (MFA completed), enforced by Postgres Row-Level Security.
- **Projected vs. actual** — every line item tracks what you planned and what actually happened, with live difference/subtotal/total math.
- **Custom categories** — rename, add, delete, drag-reorder, and pick an emoji per category, all from Settings.
- **Month rollover & history** — each calendar month is its own snapshot; navigate past months and "Start next month" carries projected values forward.
- **Insights** — a dedicated page with a projected-vs-actual chart (over-budget in red, on/under in green), an automatic "vs last month" comparison, and CSV export (this month or all history).
- **Themeable** — three preset themes × light/dark, persisted per user.

## Environments

- **Production:** [budget-manager-drab.vercel.app](https://budget-manager-drab.vercel.app) — backed by the PRD Supabase project. Deployed automatically from the `main` branch.
- **QA:** [budget-manager-qa.vercel.app](https://budget-manager-qa.vercel.app) — backed by a separate QA Supabase project. Deployed automatically from the `staging` branch.
- **Local dev** (`npm run dev`): also hits the QA Supabase project, so day-to-day coding never touches production data.

See [`docs/superpowers/DEPLOYMENT.md`](docs/superpowers/DEPLOYMENT.md) for the full workflow, migration runbook, and rollback procedures.

## Local development

1. Clone the repo and `npm install`.
2. Get the QA Supabase URL + anon key (from the project owner; or, if you're the owner, from `mcp__plugin_supabase_supabase__get_project_url` and `get_publishable_keys` against project ref `ovnkgwnlquislfdwaifh`).
3. Create `.env.development.local` at the repo root:
   ```
   VITE_SUPABASE_URL=https://ovnkgwnlquislfdwaifh.supabase.co
   VITE_SUPABASE_ANON_KEY=<qa-anon-key>
   VITE_APP_URL=http://localhost:5173
   ```
4. `npm run dev` — http://localhost:5173.

## Scripts

```
npm run dev          # dev server at http://localhost:5173, points at QA via .env.development.local
npm run build        # production build (Vercel also runs `npm test` first via vercel.json buildCommand)
npm run preview      # preview the production build (use .env.production.local if testing against PRD)
npm test             # vitest run --mode development — 97 tests across utils, api, components, and pages
npm run typecheck    # TypeScript-only check
```

> `npm test` uses `--mode development` so Vitest loads `.env.development.local`; without it, the Supabase client throws at import and several suites error out.

## Architecture

- **Frontend:** React 18 + Vite 5 + TypeScript (strict) + Tailwind CSS 3 with CSS-variable theme tokens.
- **Backend:** Supabase (Postgres + Auth + RLS). No custom server; some operations use Postgres RPCs (`rollover_month`, `move_and_delete_category`, `reorder_categories`).
- **Auth:** email + password + TOTP MFA. Budget reads require AAL2, enforced by Row-Level Security policies.
- **Data model:** four tables — `income`, `categories`, `line_items`, `user_preferences`. Income and line items are keyed per month via a `period_month` column. All derived math (difference, subtotals, totals, balance, insights) is computed in the UI.
- **Editing:** every cell is a live input. Changes auto-save on blur with optimistic UI; failures revert the local state.
- **Theming:** three preset themes (Peach, Sage, Lavender) × light/dark, persisted per user in `user_preferences`. Single CSS-variable system; switching themes is one HTML attribute change.
- **Deployment:** single Vercel project, `main` → production, `staging` → preview (aliased to the QA URL).

## Project history

- `docs/superpowers/specs/` — design specs for each version
- `docs/superpowers/plans/` — implementation plans for each version
- `docs/superpowers/DEPLOYMENT.md` — operational deployment workflow

## Roadmap (next brainstorm cycles)

- **v1.7+:** "Patterns over time" — spending-breakdown donut, trend-over-time chart, pick-any-two-month comparison — or sharing budgets with another user. Each its own brainstorm + spec + plan cycle.
- **Whenever Supabase ships native WebAuthn:** revisit passkey support.
- **Whenever we upgrade to Supabase Pro:** enable leaked-password protection.

## License

[MIT](LICENSE) © 2026 Annoyingflipper
