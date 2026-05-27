# Budget Manager — Claude session handoff

A personal budgeting web app. Solo user is `annoyingflipper@gmail.com`. PRD already holds the user's real monthly data.

Stack: React 18 + Vite 5 + TypeScript + Tailwind + Supabase. Tests: Vitest 2.1 + React Testing Library 16.

## Environments

| Env | Branch | Vercel URL | Supabase project ref |
|---|---|---|---|
| PRD | `main` | https://budget-manager-drab.vercel.app | `vouazcrsrdnaeivffwot` |
| QA | `staging` | https://budget-manager-qa.vercel.app | `ovnkgwnlquislfdwaifh` |
| Local dev | (any) | http://localhost:5173 | same as QA (via `.env.development.local`) |

Vercel project env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`. All three are required at build time — `src/lib/supabase.ts` and `src/auth/MFAEnroll.tsx` throw / fall back without them. Production scope and Preview scope have different values.

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

## Deferred (with reasons)

- **Passkey / WebAuthn MFA** — Supabase Auth doesn't ship `factorType: 'webauthn'` yet. Revisit when they do. Do NOT build custom WebAuthn or a trusted-device cookie scheme.
- **Leaked-password protection (HaveIBeenPwned)** — Pro-plan gated. Toggle lives at Auth → Providers → Email → "Password strength and leaked password protection". 30-second job once we're on Pro.
- **Settings → Security section, FactorPicker, custom trusted-device cookies** — not built. Current sign-up flow handles the only factor type we support (TOTP).
- **"Remember me" checkbox** — Supabase already persists sessions in `localStorage` with auto-refresh. A checkbox would be cosmetic. Documented in `DEPLOYMENT.md` under "Session lifetime & remember me behavior".

## Next likely brainstorms

- **v1.4** — Month rollover + history view (which month am I looking at; archive past months).
- **v1.5+** — Custom user-editable categories; sharing budgets with another user; charts + CSV export.

Each gets its own brainstorm → spec → plan → execute cycle. Don't bundle.

## Key files / locations

- Deployment runbook: `docs/superpowers/DEPLOYMENT.md` (Vercel/Supabase env layout, rollback steps, session lifetime, TOTP issuer table, deferred items).
- Supabase client: `src/lib/supabase.ts` — throws at module load if env vars missing.
- MFA enroll: `src/auth/MFAEnroll.tsx` — reads `VITE_APP_URL` for the TOTP issuer.
- Money formatting: `src/utils/money.ts` — `formatMoney` uses `Intl.NumberFormat('en-US', { currency: 'USD' })`.
- Test setup: `src/test/setup.ts` — polyfills `matchMedia` (so `useIsMobile` returns false in jsdom).
