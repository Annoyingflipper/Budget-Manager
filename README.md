# Budget Manager

A personal budgeting web app that tracks projected vs. actual monthly income and expenses.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key.
3. Apply migrations: `supabase db push` (requires `supabase link --project-ref <ref>` first).
4. `npm run dev`

## Scripts

- `npm run dev` — start dev server on http://localhost:5173
- `npm run build` — production build
- `npm test` — run tests
- `npm run typecheck` — TypeScript check

See `docs/superpowers/specs/` and `docs/superpowers/plans/` for design and implementation history.
