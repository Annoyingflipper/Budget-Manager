# Budget Manager

A personal budgeting web app that tracks projected vs. actual values across eight
expense categories, with email/password auth and TOTP MFA. Built on React + Vite
+ Tailwind + Supabase.

## Setup (first time)

1. Create a Supabase project at https://supabase.com and note the Project URL +
   anon key from **Project Settings → API**.
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env.local` and fill in your Supabase values:
   ```
   cp .env.example .env.local
   # Edit .env.local
   ```
4. Apply database migrations:
   ```
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
5. Confirm TOTP MFA is enabled under **Project Settings → Authentication → Multi-Factor Authentication**.

## Running

```
npm run dev          # dev server at http://localhost:5173
npm run build        # production build
npm run preview      # preview the production build
npm test             # run unit and component tests
npm run typecheck    # TypeScript-only check
```

## Architecture

- **Frontend:** React 18 + Vite 5 + TypeScript (strict) + Tailwind CSS 3.
- **Backend:** Supabase (Postgres + Auth). No custom server.
- **Auth:** email + password + TOTP MFA. Budget data is unreachable until the
  session reaches AAL2 (MFA completed), enforced by Row-Level Security policies.
- **Data model:** three tables — `income` (singleton per user), `categories`
  (eight per user, auto-seeded on signup), `line_items` (user-managed). All
  derived math (difference, subtotals, totals, balance) is computed in the UI.
- **Editing:** every cell is a live input. Changes auto-save on blur with
  optimistic UI; failures revert the local state.

## Project layout

See `docs/superpowers/specs/` for the design spec and
`docs/superpowers/plans/` for the implementation plan.

## Deferred for v1

- WebAuthn / passkey MFA factor (TOTP only for now).
- Month rollover and history.
- User-editable categories.
- Sharing budgets with another user.
- Charts and CSV export.
