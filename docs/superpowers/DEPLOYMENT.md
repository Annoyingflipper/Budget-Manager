# Budget Manager — Deployment & QA Workflow

This document is the operational reference for shipping changes through QA → PRD safely. The architectural decisions live in `docs/superpowers/specs/2026-05-26-v1.2-deployment-design.md`.

## Architecture at a glance

```
GitHub Annoyingflipper/Budget-Manager
                │
                ▼
       Single Vercel project
                │
   ┌────────────┴────────────┐
   main branch          staging branch
   Production env       Preview env
   PRD Supabase         QA Supabase
   |                    |
   budget-manager-drab  budget-manager-qa
     .vercel.app          .vercel.app
                                ▲
                                │
                  Local dev (npm run dev) also hits QA
```

- **Production:** `main` → `https://budget-manager-drab.vercel.app` → PRD Supabase (`vouazcrsrdnaeivffwot`)
- **QA:** `staging` → `https://budget-manager-qa.vercel.app` → QA Supabase (`ovnkgwnlquislfdwaifh`)
- **Local dev:** `.env.development.local` → QA Supabase

## Day-to-day workflow

1. Code locally on a feature branch (`git checkout -b feat/something staging`) or directly on `staging`.
2. Run tests + dev server locally. `npm test` and `npm run dev`. Local talks to QA Supabase — safe to break things.
3. If you wrote a new SQL migration, apply it to QA via the Supabase MCP `apply_migration` tool (project_id = QA ref `ovnkgwnlquislfdwaifh`).
4. Commit, push to `staging`. Vercel builds + deploys to `budget-manager-qa.vercel.app` automatically.
5. Smoke-test the change on the QA URL.
6. **Once QA is green**, apply the same SQL migration to PRD via `apply_migration` (project_id = `vouazcrsrdnaeivffwot`).
7. Merge `staging` → `main`. Vercel builds + deploys to production.
8. Quick smoke check on the PRD URL.

## Env var reference

| Surface | File / Dashboard | Points at |
|---|---|---|
| `npm run dev` | `.env.development.local` (gitignored) | QA Supabase |
| `npm run preview` (rare) | `.env.production.local` (gitignored) | PRD Supabase |
| Vercel Production | Dashboard → Env Vars → Production | PRD Supabase |
| Vercel Preview (all branches) | Dashboard → Env Vars → Preview | QA Supabase |

## Applying a new migration

1. Write the SQL: `supabase/migrations/000N_<name>.sql`.
2. Commit on `staging`.
3. Apply to QA via MCP:
   - Tool: `mcp__plugin_supabase_supabase__apply_migration`
   - `project_id`: `ovnkgwnlquislfdwaifh` (QA)
   - `name`: the migration name in snake_case (no leading number, no `.sql`)
   - `query`: the contents of the SQL file
4. Verify QA: `list_tables`, `list_migrations`, `get_advisors` — all clean.
5. Push to `staging`. Vercel deploys QA.
6. Smoke-test on QA URL.
7. Apply the **same** migration to PRD (same MCP call, project_id = `vouazcrsrdnaeivffwot`).
8. Merge `staging` → `main`. Vercel deploys PRD.

## Rollback

**Production deploy broke something.**
Vercel dashboard → Deployments → find the last known-good deployment → three-dot menu → **Promote to Production**. Instant rollback to that bundle. Then fix the broken commit on `staging`.

**Migration broke PRD.**
Two options, in priority order:
1. **Forward-fix migration** — write a new migration on QA that fixes or reverts the broken one, validate it on QA, then apply to PRD. Safer; preserves all data.
2. **Supabase Point-in-Time Recovery** — Supabase dashboard → Database → PITR → choose a timestamp before the bad migration. Destroys all writes since that timestamp. Only use if data is genuinely corrupted and option 1 isn't viable.

**QA and PRD schemas drifted.**
Run `list_migrations` against both project refs and diff. Apply the missing migration to the lagging side.

## Common failure modes

- **Vercel build fails on push:** check the Vercel build log. Usually tests, sometimes env var typos.
- **App loads but Supabase calls 401/permission-denied:** env vars are pointing at the wrong project, or the user hasn't completed MFA (AAL2 required for budget reads).
- **App loads but no data on PRD URL:** wrong Vercel env (probably Preview env vars are set on Production by mistake). Double-check the Production column in Vercel → Env Vars.

## How to add a new version sub-page in Notion

When you ship a new version (v1.3, v1.4, etc.):
1. Open the Budget Manager hub in Notion.
2. Duplicate the most recent version sub-page.
3. Rename to the new version. Update the **What shipped** and **Smoke test** sections.
4. Link the new sub-page from the hub's Versions index.
5. Mark the previous version Complete once the new one is validated.
