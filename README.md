# Budget Manager

A personal budgeting web app that tracks projected vs. actual values across eight
expense categories, with email/password + TOTP MFA auth. Themeable (Peach default,
Sage, Lavender) with light + dark modes. Built on React + Vite + Tailwind + Supabase
and deployed to Vercel.

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
   ```
4. `npm run dev` — http://localhost:5173.

## Scripts

```
npm run dev          # dev server at http://localhost:5173, points at QA via .env.development.local
npm run build        # production build (Vercel also runs `npm test` first via vercel.json buildCommand)
npm run preview      # preview the production build (use .env.production.local if testing against PRD)
npm test             # vitest run, 32 tests across money utilities, ThemeProvider, LineItemRow, DraftRow
npm run typecheck    # TypeScript-only check
```

## Architecture

- **Frontend:** React 18 + Vite 5 + TypeScript (strict) + Tailwind CSS 3 with CSS-variable theme tokens.
- **Backend:** Supabase (Postgres + Auth + RLS). No custom server.
- **Auth:** email + password + TOTP MFA. Budget data is unreachable until the session reaches AAL2 (MFA completed), enforced by Row-Level Security policies.
- **Data model:** four tables — `income`, `categories`, `line_items`, `user_preferences`. All derived math (difference, subtotals, totals, balance) is computed in the UI.
- **Editing:** every cell is a live input. Changes auto-save on blur with optimistic UI; failures revert the local state.
- **Theming:** three preset themes (Peach, Sage, Lavender) × light/dark, persisted per user in `user_preferences`. Single CSS variable system; switching themes is one HTML attribute change.
- **Deployment:** single Vercel project, `main` → production, `staging` → preview (aliased to the QA URL).

## Project history

- `docs/superpowers/specs/` — design specs for each version
- `docs/superpowers/plans/` — implementation plans for each version
- `docs/superpowers/DEPLOYMENT.md` — operational deployment workflow

## Deferred (future versions)

- **v1.3:** WebAuthn / passkey MFA + leaked-password protection + remaining test gaps
- **v1.4+:** Month rollover and history, custom user-editable categories, sharing budgets with another user, charts + CSV export — each its own brainstorm + spec + plan cycle.
