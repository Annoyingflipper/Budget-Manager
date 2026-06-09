# Playwright E2E Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a senior-grade Playwright E2E suite that exercises the real running app against the QA Supabase backend (real routing, RLS/AAL2, downloads, theming, a11y), complementing the mocked Vitest tests.

**Architecture:** `@playwright/test` (TypeScript) with the Page Object Model, fixtures for composition, a `setup` project that signs in through the real UI (clearing the AAL2 TOTP challenge with `otplib`) and saves `storageState`, parallel-safe data isolation via a service-role-backed `scopedData` fixture, web-first assertions, a console/network guard, `@axe-core/playwright` a11y checks, tagging, and rich CI reporting. Lives entirely under `e2e/` + `playwright.config.ts`; the only app-code change is a small, inert set of `data-testid` attributes.

**Tech Stack:** `@playwright/test`, `otplib`, `@axe-core/playwright`, `dotenv`, `@supabase/supabase-js` (service role, test infra only), Node 24, GitHub Actions.

**Source spec:** `docs/superpowers/specs/2026-06-07-playwright-e2e-design.md`

---

## Key facts the implementer must know (verified against the codebase)

- **RLS requires AAL2 on every budget query** (`supabase/migrations/0002_rls.sql`: `(auth.jwt() ->> 'aal') = 'aal2'`). Any authenticated session that hasn't cleared the TOTP challenge gets permission-denied. The `setup` project must reach AAL2 before saving `storageState`.
- **The service-role client bypasses RLS entirely** — it does not have an `auth.uid()` and **cannot call the RPCs** (`reorder_categories`, `move_and_delete_category`, `rollover_month`) because they hard-check `auth.jwt() ->> 'aal' = 'aal2'`. Service-role seed/cleanup uses **direct table writes** with an explicit `user_id`, never the RPCs.
- **New users are auto-seeded with 8 categories** (`0014_seed_trigger_with_icons.sql`): Services 🛠, Entertainment 🎬, Loans 🏦, Taxes 📋, Savings or Investments 💎, Monthly Payments 🧾, Personal Care 🧴, Other ✨. No income row is seeded (created lazily on first save).
- **`categories` has `unique (user_id, name)`**; `line_items.category_id` is `ON DELETE RESTRICT` (delete line items before their category).
- **App routing is state, not URLs** (`src/App.tsx`): one route `/`. Pages switch via `setPage('budget'|'settings'|'insights')`. So page objects navigate by clicking Header buttons, not `page.goto('/settings')`.
- **App opens on the latest month** (`listMonths()[0]`). With baseline seeding May + June 2026, it opens on June; `prevMonth` = May exists, so Insights' "vs last month" has a prior.
- **No native `window.confirm` in any in-scope flow.** Line-item delete is a lifted `✕`→`✓` in-table confirm; category delete is a custom `role="dialog"` modal. (Rollover uses `window.confirm` but is out of scope.) No `browser_handle_dialog` needed.
- **`npm test` is `vitest run --mode development`** and must stay green after the testid additions. `npm run typecheck` is `tsc --noEmit` over `src` only.
- **Local app env** comes from `.env.development.local` (QA project) — already present; the dev server `npm run dev` loads it. E2E harness secrets live separately in `.env.e2e.local`.

## File structure (created by this plan)

```
e2e/
  fixtures/
    test.ts                    # central test/expect; wires all fixtures
    console-guard.fixture.ts    # fails on console.error / pageerror / requestfailed
  pages/
    LoginPage.ts  MfaChallengePage.ts  DashboardPage.ts  SettingsPage.ts  InsightsPage.ts
  components/
    HeaderComponent.ts  ToastComponent.ts  LineItemRowComponent.ts
    CategoryTableComponent.ts  CategoryRowComponent.ts  ThemeSwitcherComponent.ts
  support/
    env.ts  supabaseAdmin.ts  totp.ts  totp.test.ts  seed.ts  auth.setup.ts
  data/
    baseline.ts
  specs/
    auth-gate.e2e.ts  dashboard-crud.e2e.ts  categories-editor.e2e.ts
    insights-export.e2e.ts  theme-switching.e2e.ts
  README.md
playwright.config.ts
tsconfig.e2e.json
scripts/
  e2e-provision-user.ts
.env.e2e.local.example
```

App files modified (testids only): `src/components/LineItemRow.tsx`, `src/components/BalanceHero.tsx`, `src/components/CategoryTable.tsx`, `src/components/ProjectedVsActualChart.tsx`.
Repo files modified: `package.json`, `.gitignore`, `.github/workflows/ci.yml`.

---

## Task 1: Install dependencies and scaffold tooling

**Files:**
- Modify: `package.json` (devDependencies + scripts)
- Create: `tsconfig.e2e.json`
- Modify: `.gitignore`
- Create: `.env.e2e.local.example`

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
npm install -D @playwright/test@latest @axe-core/playwright@latest otplib@latest dotenv@latest
```
Expected: packages added to `devDependencies`, `package-lock.json` updated, `0 vulnerabilities` (or unchanged from baseline).

- [ ] **Step 2: Install the Chromium browser binary**

Run:
```bash
npx playwright install chromium
```
Expected: Chromium downloaded (no error).

- [ ] **Step 3: Add npm scripts**

In `package.json`, add to `"scripts"` (keep existing entries):
```json
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "e2e:smoke": "playwright test --grep @smoke",
    "e2e:report": "playwright show-report",
    "e2e:typecheck": "tsc -p tsconfig.e2e.json --noEmit",
    "e2e:provision": "node --experimental-strip-types scripts/e2e-provision-user.ts"
```

- [ ] **Step 4: Create `tsconfig.e2e.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["node", "@playwright/test"],
    "allowImportingTsExtensions": true
  },
  "include": ["e2e", "playwright.config.ts", "scripts"]
}
```

- [ ] **Step 5: Update `.gitignore`**

Append:
```
# Playwright E2E
e2e/.auth/
playwright-report/
test-results/
.env.e2e.local
```

- [ ] **Step 6: Create `.env.e2e.local.example`**

```bash
# Copy to .env.e2e.local (git-ignored) and fill in REAL QA values.
# E2E hits the real QA Supabase backend; placeholders will NOT work (unlike the unit-test CI job).

# Public client vars (same values as .env.development.local — the QA project).
VITE_SUPABASE_URL=https://ovnkgwnlquislfdwaifh.supabase.co
VITE_SUPABASE_ANON_KEY=your-qa-anon-key

# Dedicated throwaway E2E test user on the QA project.
E2E_USER_EMAIL=e2e@budget-manager.test
E2E_USER_PASSWORD=choose-a-strong-password
E2E_TOTP_SECRET=captured-from-provisioning-script

# QA service-role key — used ONLY by auth.setup.ts (reseed) and the provisioning script.
# Never imported by app code. Bypasses RLS, so handle with care.
SUPABASE_SERVICE_ROLE_KEY=your-qa-service-role-key
```

- [ ] **Step 7: Verify typecheck of the (empty) e2e project config is valid**

Run:
```bash
npx tsc -p tsconfig.e2e.json --noEmit
```
Expected: no error (no e2e files yet, so it just validates the config).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.e2e.json .gitignore .env.e2e.local.example
git commit -m "chore(e2e): scaffold Playwright tooling + deps"
```

---

## Task 2: Typed env loader (`support/env.ts`)

**Files:**
- Create: `e2e/support/env.ts`

- [ ] **Step 1: Write `e2e/support/env.ts`**

```ts
import { config as loadDotenv } from 'dotenv';

// Load harness secrets. Playwright's config also loads this, but importing here
// keeps support utilities usable standalone (e.g. the provisioning script).
loadDotenv({ path: '.env.e2e.local' });

type Required =
  | 'VITE_SUPABASE_URL'
  | 'VITE_SUPABASE_ANON_KEY'
  | 'E2E_USER_EMAIL'
  | 'E2E_USER_PASSWORD'
  | 'E2E_TOTP_SECRET'
  | 'SUPABASE_SERVICE_ROLE_KEY';

const REQUIRED: Required[] = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'E2E_USER_EMAIL',
  'E2E_USER_PASSWORD',
  'E2E_TOTP_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
];

function read(): Record<Required, string> {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `E2E env misconfigured. Missing: ${missing.join(', ')}.\n` +
        'Copy .env.e2e.local.example to .env.e2e.local (local) or set GitHub secrets (CI).',
    );
  }
  return Object.fromEntries(REQUIRED.map((k) => [k, process.env[k] as string])) as Record<
    Required,
    string
  >;
}

export const env = read();

export const APP_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
```

- [ ] **Step 2: Verify it typechecks**

Run:
```bash
npx tsc -p tsconfig.e2e.json --noEmit
```
Expected: no error.

- [ ] **Step 3: Commit**

```bash
git add e2e/support/env.ts
git commit -m "feat(e2e): typed, fail-fast env loader"
```

---

## Task 3: Service-role admin client (`support/supabaseAdmin.ts`)

**Files:**
- Create: `e2e/support/supabaseAdmin.ts`

- [ ] **Step 1: Write `e2e/support/supabaseAdmin.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Service-role client for TEST INFRA ONLY (seed/cleanup, provisioning).
// Bypasses RLS — never import this from src/. It has no auth.uid(), so it must
// write user_id explicitly and cannot call the AAL2-gated RPCs.
export const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function getTestUserId(email: string): Promise<string> {
  // Single dedicated test user; first page is enough.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`Test user not found: ${email}. Run npm run e2e:provision first.`);
  return user.id;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc -p tsconfig.e2e.json --noEmit`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
git add e2e/support/supabaseAdmin.ts
git commit -m "feat(e2e): service-role admin client + test-user lookup"
```

---

## Task 4: TOTP generator (`support/totp.ts`) — TDD

**Files:**
- Create: `e2e/support/totp.ts`
- Create: `e2e/support/totp.test.ts`

> This utility is pure logic, so we test it first. It runs under Vitest (lives in `e2e/` but is a plain unit test). Vitest's default `include` is `**/*.{test,spec}.*`, so it will be picked up by `npm test`. It does NOT import `src/lib/supabase.ts`, so it won't trip the env guard.

- [ ] **Step 1: Write the failing test `e2e/support/totp.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { authenticator } from 'otplib';
import { generateTotp } from './totp';

describe('generateTotp', () => {
  it('produces a 6-digit numeric code', () => {
    const secret = authenticator.generateSecret();
    const code = generateTotp(secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('produces a code the same secret verifies', () => {
    const secret = authenticator.generateSecret();
    const code = generateTotp(secret);
    expect(authenticator.verify({ token: code, secret })).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run:
```bash
npx vitest run e2e/support/totp.test.ts --mode development
```
Expected: FAIL — `Failed to resolve import "./totp"` (module does not exist yet).

- [ ] **Step 3: Write `e2e/support/totp.ts`**

```ts
import { authenticator } from 'otplib';

// RFC-6238 TOTP. otplib's `authenticator` defaults match Supabase's TOTP factor
// (SHA1, 6 digits, 30s step), so codes generated here clear the MFA challenge.
export function generateTotp(secret: string): string {
  return authenticator.generate(secret);
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run:
```bash
npx vitest run e2e/support/totp.test.ts --mode development
```
Expected: PASS (2 tests).

- [ ] **Step 5: Confirm the full unit suite is still green**

Run:
```bash
npm test
```
Expected: all tests pass (97 prior + 2 new = 99).

- [ ] **Step 6: Commit**

```bash
git add e2e/support/totp.ts e2e/support/totp.test.ts
git commit -m "feat(e2e): TOTP code generator with unit tests"
```

---

## Task 5: Baseline dataset (`data/baseline.ts`)

**Files:**
- Create: `e2e/data/baseline.ts`

> Single source of truth for what the test user holds after a reseed. Read-only specs (insights, theme) assert against these values. Two months so Insights has a prior month. June Services is **over** budget (red), June Entertainment is **under** (green) — exercised by the insights spec.

- [ ] **Step 1: Write `e2e/data/baseline.ts`**

```ts
// The canonical seeded dataset. reseedTestUser() (support/seed.ts) writes exactly
// this; read-only specs assert against it. Keep numbers stable.

export const MONTH_CURRENT = '2026-06-01';
export const MONTH_PRIOR = '2026-05-01';

export type SeedCategory = { name: string; display_order: number; icon: string };

// Matches the signup seed trigger (0014). Reseed resets to exactly these.
export const DEFAULT_CATEGORIES: SeedCategory[] = [
  { name: 'Services', display_order: 1, icon: '🛠' },
  { name: 'Entertainment', display_order: 2, icon: '🎬' },
  { name: 'Loans', display_order: 3, icon: '🏦' },
  { name: 'Taxes', display_order: 4, icon: '📋' },
  { name: 'Savings or Investments', display_order: 5, icon: '💎' },
  { name: 'Monthly Payments', display_order: 6, icon: '🧾' },
  { name: 'Personal Care', display_order: 7, icon: '🧴' },
  { name: 'Other', display_order: 8, icon: '✨' },
];

export type SeedItem = {
  category: string; // category name -> resolved to id at seed time
  name: string;
  projected: number;
  actual: number;
};

export const INCOME = {
  [MONTH_CURRENT]: { projected: 5000, actual: 5000 },
  [MONTH_PRIOR]: { projected: 5000, actual: 5000 },
} as const;

// June: Services actual 135 > projected 130 (OVER/red);
//       Entertainment actual 25 < projected 30 (UNDER/green).
export const ITEMS_CURRENT: SeedItem[] = [
  { category: 'Services', name: 'Internet', projected: 80, actual: 85 },
  { category: 'Services', name: 'Phone', projected: 50, actual: 50 },
  { category: 'Entertainment', name: 'Streaming', projected: 30, actual: 25 },
];

// May actuals differ so the "vs last month" delta is non-zero:
//   Services 165? no — May Services actual 80; June 135 -> +55.
//   Entertainment May 40; June 25 -> -15.
export const ITEMS_PRIOR: SeedItem[] = [
  { category: 'Services', name: 'Internet', projected: 80, actual: 80 },
  { category: 'Entertainment', name: 'Streaming', projected: 30, actual: 40 },
];

// Convenience for assertions.
export const JUNE_SERVICES_ACTUAL = 135; // 85 + 50
export const JUNE_SERVICES_PROJECTED = 130; // 80 + 50
export const JUNE_ENTERTAINMENT_ACTUAL = 25;
export const JUNE_ENTERTAINMENT_PROJECTED = 30;
export const SERVICES_DELTA = JUNE_SERVICES_ACTUAL - 80; // +55 vs May
export const ENTERTAINMENT_DELTA = JUNE_ENTERTAINMENT_ACTUAL - 40; // -15 vs May
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc -p tsconfig.e2e.json --noEmit`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
git add e2e/data/baseline.ts
git commit -m "feat(e2e): canonical baseline dataset"
```

---

## Task 6: Seed/reseed helper (`support/seed.ts`)

**Files:**
- Create: `e2e/support/seed.ts`

> Idempotent reseed via the service-role client (direct writes, explicit `user_id`). Order matters: delete line_items before categories (FK RESTRICT). Returns a name→id map so the `scopedData` fixture and read-only specs can resolve baseline category ids when needed.

- [ ] **Step 1: Write `e2e/support/seed.ts`**

```ts
import { admin, getTestUserId } from './supabaseAdmin';
import { env } from './env';
import {
  DEFAULT_CATEGORIES,
  INCOME,
  ITEMS_CURRENT,
  ITEMS_PRIOR,
  MONTH_CURRENT,
  MONTH_PRIOR,
  type SeedItem,
} from '../data/baseline';

export type CategoryIdMap = Map<string, number>;

/** Reset the test user to the canonical baseline. Safe to call repeatedly. */
export async function reseedTestUser(): Promise<CategoryIdMap> {
  const uid = await getTestUserId(env.E2E_USER_EMAIL);

  // 1. Wipe (line_items first — FK ON DELETE RESTRICT from categories).
  await del('line_items', uid);
  await del('income', uid);
  await del('categories', uid);

  // 2. Re-create the 8 default categories.
  const { data: cats, error: catErr } = await admin
    .from('categories')
    .insert(DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: uid })))
    .select('id, name');
  if (catErr) throw catErr;
  const byName: CategoryIdMap = new Map((cats ?? []).map((c) => [c.name as string, c.id as number]));

  // 3. Income for both months.
  await admin.from('income').insert([
    { user_id: uid, period_month: MONTH_CURRENT, ...INCOME[MONTH_CURRENT] },
    { user_id: uid, period_month: MONTH_PRIOR, ...INCOME[MONTH_PRIOR] },
  ]);

  // 4. Line items for both months.
  await insertItems(uid, MONTH_CURRENT, ITEMS_CURRENT, byName);
  await insertItems(uid, MONTH_PRIOR, ITEMS_PRIOR, byName);

  return byName;
}

async function del(table: 'line_items' | 'income' | 'categories', uid: string): Promise<void> {
  const { error } = await admin.from(table).delete().eq('user_id', uid);
  if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
}

async function insertItems(
  uid: string,
  periodMonth: string,
  items: SeedItem[],
  byName: CategoryIdMap,
): Promise<void> {
  const rows = items.map((i) => {
    const categoryId = byName.get(i.category);
    if (categoryId == null) throw new Error(`Unknown baseline category: ${i.category}`);
    return {
      user_id: uid,
      category_id: categoryId,
      name: i.name,
      projected: i.projected,
      actual: i.actual,
      period_month: periodMonth,
    };
  });
  const { error } = await admin.from('line_items').insert(rows);
  if (error) throw error;
}

/** Resolve a baseline category id by name (for read-only spec assertions). */
export async function categoryIdByName(name: string): Promise<number> {
  const uid = await getTestUserId(env.E2E_USER_EMAIL);
  const { data, error } = await admin
    .from('categories')
    .select('id')
    .eq('user_id', uid)
    .eq('name', name)
    .single();
  if (error) throw error;
  return data.id as number;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc -p tsconfig.e2e.json --noEmit`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
git add e2e/support/seed.ts
git commit -m "feat(e2e): service-role reseed helper + baseline id lookup"
```

---

## Task 7: One-time provisioning script + provision the user (USER CHECKPOINT)

**Files:**
- Create: `scripts/e2e-provision-user.ts`

> This is the only step the implementer cannot run autonomously: it needs the QA **service-role key** and creates a real auth user with a verified TOTP factor. Build the script, then hand the run + secret capture to the user.

- [ ] **Step 1: Write `scripts/e2e-provision-user.ts`**

```ts
// One-time, idempotent E2E test-user provisioning. Run with:
//   npm run e2e:provision
// Requires .env.e2e.local with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
// E2E_USER_EMAIL, E2E_USER_PASSWORD, SUPABASE_SERVICE_ROLE_KEY.
// Prints E2E_TOTP_SECRET — copy it into .env.e2e.local and the GitHub secret.
import { config as loadDotenv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { authenticator } from 'otplib';

loadDotenv({ path: '.env.e2e.local' });

const url = req('VITE_SUPABASE_URL');
const anon = req('VITE_SUPABASE_ANON_KEY');
const serviceRole = req('SUPABASE_SERVICE_ROLE_KEY');
const email = req('E2E_USER_EMAIL');
const password = req('E2E_USER_PASSWORD');

function req(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ${k} in .env.e2e.local`);
  return v;
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // 1. Create (or find) the user, email pre-confirmed.
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let userId = list.users.find((u) => u.email === email)?.id;
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`Created user ${email} (${userId})`);
  } else {
    console.log(`User ${email} already exists (${userId})`);
  }

  // 2. Sign in as the user (anon client) to enroll a TOTP factor.
  const userClient = createClient(url, anon, { auth: { persistSession: false } });
  const { error: signInErr } = await userClient.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;

  const { data: factors } = await userClient.auth.mfa.listFactors();
  if (factors?.totp.some((f) => f.status === 'verified')) {
    console.log('A verified TOTP factor already exists.');
    console.log('If you lost the secret, unenroll it in Supabase Auth and re-run.');
    return;
  }

  const { data: enroll, error: enrollErr } = await userClient.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'e2e',
  });
  if (enrollErr) throw enrollErr;
  const secret = enroll.totp.secret;

  // 3. Challenge + verify to mark the factor verified.
  const { data: challenge, error: chErr } = await userClient.auth.mfa.challenge({
    factorId: enroll.id,
  });
  if (chErr) throw chErr;
  const code = authenticator.generate(secret);
  const { error: verifyErr } = await userClient.auth.mfa.verify({
    factorId: enroll.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyErr) throw verifyErr;

  console.log('\n✅ TOTP factor enrolled + verified.');
  console.log('\nAdd this to .env.e2e.local and your GitHub secret E2E_TOTP_SECRET:\n');
  console.log(`E2E_TOTP_SECRET=${secret}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc -p tsconfig.e2e.json --noEmit`
Expected: no error.

- [ ] **Step 3: Commit the script**

```bash
git add scripts/e2e-provision-user.ts
git commit -m "feat(e2e): one-time test-user provisioning script"
```

- [ ] **Step 4: USER CHECKPOINT — provision the user**

Hand off to the user with these instructions:
1. `cp .env.e2e.local.example .env.e2e.local`
2. Fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (QA project: Supabase → Settings → API), `E2E_USER_EMAIL` (e.g. `e2e@budget-manager.test`), `E2E_USER_PASSWORD` (strong).
3. Run `npm run e2e:provision`.
4. Copy the printed `E2E_TOTP_SECRET=…` into `.env.e2e.local`.
5. Add all of `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_TOTP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` as **GitHub Actions repository secrets** (Settings → Secrets and variables → Actions).

Do not proceed to Task 9 verification until `.env.e2e.local` is fully populated.

---

## Task 8: Playwright config (`playwright.config.ts`)

**Files:**
- Create: `playwright.config.ts`

- [ ] **Step 1: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';
import { config as loadDotenv } from 'dotenv';

// Harness secrets for local runs (CI injects them as env vars instead).
loadDotenv({ path: '.env.e2e.local' });

const isCI = !!process.env.CI;
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  expect: { timeout: 10_000 }, // raised for backend round-trips
  reporter: isCI
    ? [
        ['list'],
        ['html', { open: 'never' }],
        ['junit', { outputFile: 'results.xml' }],
        ['github'],
      ]
    : [['list']],
  use: {
    baseURL,
    testIdAttribute: 'data-testid',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: isCI ? 'on-first-retry' : 'off',
    video: isCI ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? '',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? '',
      VITE_APP_URL: baseURL,
    },
  },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc -p tsconfig.e2e.json --noEmit`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "feat(e2e): Playwright config (setup+chromium projects, webServer, reporters)"
```

---

## Task 9: Auth setup project (`support/auth.setup.ts`)

**Files:**
- Create: `e2e/support/auth.setup.ts`

> Runs once before the `chromium` project. Reseeds baseline (service role), then drives the REAL login + TOTP UI to reach AAL2, and saves `storageState`. Driving the UI (rather than constructing the session) guarantees the persisted localStorage session matches what supabase-js expects.

- [ ] **Step 1: Write `e2e/support/auth.setup.ts`**

```ts
import { test as setup, expect } from '@playwright/test';
import { reseedTestUser } from './seed';
import { generateTotp } from './totp';
import { env } from './env';

const STORAGE_STATE = 'e2e/.auth/user.json';

setup('authenticate and reach AAL2', async ({ page }) => {
  // 1. Reset the backend to baseline before anyone signs in.
  await reseedTestUser();

  // 2. Real login UI.
  await page.goto('/');
  await page.getByPlaceholder('Email').fill(env.E2E_USER_EMAIL);
  await page.getByPlaceholder('Password').fill(env.E2E_USER_PASSWORD);
  await page.getByRole('button', { name: /log in/i }).click();

  // 3. TOTP challenge — generate a fresh code and submit.
  const codeInput = page.getByPlaceholder('123456');
  await expect(codeInput).toBeVisible();
  await codeInput.fill(generateTotp(env.E2E_TOTP_SECRET));
  await page.getByRole('button', { name: /continue|verifying/i }).click();

  // 4. Dashboard renders only at AAL2 (RLS-gated budget read succeeded).
  await expect(page.getByTestId('projected-balance')).toBeVisible();

  // 5. Persist the authenticated, AAL2 storage state.
  await page.context().storageState({ path: STORAGE_STATE });
});
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc -p tsconfig.e2e.json --noEmit`
Expected: no error. (Note: `getByTestId('projected-balance')` requires the Task 10 testid; verification of the running setup happens after Task 10.)

- [ ] **Step 3: Commit**

```bash
git add e2e/support/auth.setup.ts
git commit -m "feat(e2e): auth setup project (reseed + UI login -> AAL2 storageState)"
```

---

## Task 10: App `data-testid` additions (only app-code change)

**Files:**
- Modify: `src/components/BalanceHero.tsx`
- Modify: `src/components/LineItemRow.tsx`
- Modify: `src/components/CategoryTable.tsx`
- Modify: `src/components/ProjectedVsActualChart.tsx`

> Inert attributes only — no behavior or visual change. After editing, the existing Vitest suite and typecheck must stay green.

- [ ] **Step 1: BalanceHero — add testids to the two figures**

In `src/components/BalanceHero.tsx`, change the two value `<div>`s:

```tsx
          <div className="text-2xl font-extrabold" data-testid="projected-balance">{formatMoney(projectedBalance)}</div>
```
and
```tsx
          <div className={`text-2xl font-extrabold ${balanceClass}`} data-testid="actual-balance">
            {formatMoney(actualBalance)}
          </div>
```

- [ ] **Step 2: LineItemRow — add a stable root testid (desktop branch)**

In `src/components/LineItemRow.tsx`, the desktop return (the `<div className="grid items-center gap-1.5" ...>` near the end) gets a testid:

```tsx
    <div
      className="grid items-center gap-1.5"
      style={{ gridTemplateColumns: '1.4fr 80px 80px 80px 24px' }}
      data-testid={`line-item-${item.id}`}
    >
```

- [ ] **Step 3: CategoryTable — add a testid to the subtotal value**

In `src/components/CategoryTable.tsx`, the subtotal `<span>` wrapping the figures gets a testid keyed by category id:

```tsx
        <span data-testid={`subtotal-${category.id}`}>
          <span className="text-muted">{formatMoney(subProjected)} / {formatMoney(subActual)}</span>{' '}
          ·{' '}
          <span className={`font-bold ${differenceClass('cost', subDiff)}`}>{formatMoney(subDiff)}</span>
        </span>
```

- [ ] **Step 4: ProjectedVsActualChart — add a testid to each bar row**

In `src/components/ProjectedVsActualChart.tsx`, the `.map` row wrapper gets a testid keyed by category id:

```tsx
        return (
          <div key={t.id} data-testid={`chart-row-${t.id}`}>
```

- [ ] **Step 5: Run the unit suite + typecheck — both must stay green**

Run:
```bash
npm run typecheck && npm test
```
Expected: typecheck clean; all tests pass (99). If any component test asserts on exact DOM structure and breaks, update that test to keep asserting the same behavior with the testid present (testids are additive, so this is unlikely).

- [ ] **Step 6: Commit**

```bash
git add src/components/BalanceHero.tsx src/components/LineItemRow.tsx src/components/CategoryTable.tsx src/components/ProjectedVsActualChart.tsx
git commit -m "feat(e2e): add inert data-testid hooks for E2E selectors"
```

- [ ] **Step 7: Verify the setup project runs end-to-end**

Pre-req: `.env.e2e.local` fully populated (Task 7 checkpoint done).

Run:
```bash
npx playwright test --project=setup
```
Expected: PASS — `e2e/.auth/user.json` created. (Playwright auto-starts the dev server.) If it fails on the balance testid, re-check Step 1. If it fails at the TOTP step, re-check the secret in `.env.e2e.local`.

- [ ] **Step 8: Commit (no new files; this is a verification gate)**

No commit needed if `.auth/` is git-ignored (it is). Proceed.

---

## Task 11: Component objects

**Files:**
- Create: `e2e/components/HeaderComponent.ts`
- Create: `e2e/components/ToastComponent.ts`
- Create: `e2e/components/LineItemRowComponent.ts`
- Create: `e2e/components/CategoryTableComponent.ts`
- Create: `e2e/components/CategoryRowComponent.ts`
- Create: `e2e/components/ThemeSwitcherComponent.ts`

> Pure locator/action classes. No assertions inside. Each takes a `Page` (and where relevant a parent `Locator` or id). Typecheck-only verification.

- [ ] **Step 1: `e2e/components/HeaderComponent.ts`**

```ts
import type { Page, Locator } from '@playwright/test';

export class HeaderComponent {
  readonly root: Locator;
  constructor(private page: Page) {
    this.root = page.locator('header').first();
  }
  get prevMonth(): Locator { return this.root.getByRole('button', { name: 'Previous month' }); }
  get nextMonth(): Locator { return this.root.getByRole('button', { name: 'Next month' }); }
  get startNextMonth(): Locator { return this.root.getByRole('button', { name: /^Start / }); }
  get monthLabel(): Locator { return this.root.getByText(/^[A-Z][a-z]+ \d{4}$/); }
  get modeToggle(): Locator { return this.root.getByRole('button', { name: 'Toggle color mode' }); }
  get insightsButton(): Locator { return this.root.getByRole('button', { name: /Insights/ }); }
  get settingsButton(): Locator { return this.root.getByRole('button', { name: /Settings/ }); }
  get logoutButton(): Locator { return this.root.getByRole('button', { name: 'Log out' }); }

  async goPrev(): Promise<void> { await this.prevMonth.click(); }
  async openInsights(): Promise<void> { await this.insightsButton.click(); }
  async openSettings(): Promise<void> { await this.settingsButton.click(); }
  async toggleMode(): Promise<void> { await this.modeToggle.click(); }
}
```

- [ ] **Step 2: `e2e/components/ToastComponent.ts`**

```ts
import type { Page, Locator } from '@playwright/test';

export class ToastComponent {
  readonly root: Locator;
  constructor(page: Page) {
    this.root = page.getByRole('status');
  }
  get message(): Locator { return this.root; }
}
```

- [ ] **Step 3: `e2e/components/LineItemRowComponent.ts`**

```ts
import type { Page, Locator } from '@playwright/test';

export class LineItemRowComponent {
  readonly root: Locator;
  constructor(page: Page, itemId: number) {
    this.root = page.getByTestId(`line-item-${itemId}`);
  }
  get nameInput(): Locator { return this.root.locator('input[type="text"]'); }
  get projectedInput(): Locator { return this.root.locator('input[type="number"]').nth(0); }
  get actualInput(): Locator { return this.root.locator('input[type="number"]').nth(1); }
  get deleteButton(): Locator { return this.root.getByRole('button', { name: 'Delete row' }); }
  get confirmDeleteButton(): Locator { return this.root.getByRole('button', { name: 'Confirm delete' }); }

  // Saves happen onBlur. Fill then blur by pressing Tab.
  async setActual(value: number): Promise<void> {
    await this.actualInput.fill(String(value));
    await this.actualInput.blur();
  }
  async setProjected(value: number): Promise<void> {
    await this.projectedInput.fill(String(value));
    await this.projectedInput.blur();
  }
  async delete(): Promise<void> {
    await this.deleteButton.click();      // ✕ -> arms confirm
    await this.confirmDeleteButton.click(); // ✓ -> deletes
  }
}
```

- [ ] **Step 4: `e2e/components/CategoryTableComponent.ts`**

```ts
import type { Page, Locator } from '@playwright/test';

// Scoped to the <section> that contains this category's subtotal testid.
export class CategoryTableComponent {
  readonly root: Locator;
  constructor(private page: Page, private categoryId: number) {
    this.root = page.locator('section').filter({
      has: page.getByTestId(`subtotal-${categoryId}`),
    });
  }
  get subtotal(): Locator { return this.page.getByTestId(`subtotal-${this.categoryId}`); }
  get addItemButton(): Locator { return this.root.getByRole('button', { name: '+ Add item' }); }

  // Draft inputs (DraftRow) live in this section once "Add item" is clicked.
  get draftName(): Locator { return this.root.getByPlaceholder('Item name'); }
  get draftProjected(): Locator { return this.root.getByLabel('Projected'); }
  get draftActual(): Locator { return this.root.getByLabel('Actual'); }

  async addItem(name: string, projected: number, actual: number): Promise<void> {
    await this.addItemButton.click();
    await this.draftName.fill(name);
    await this.draftProjected.fill(String(projected));
    await this.draftActual.fill(String(actual));
    await this.draftName.press('Enter'); // commits the draft
  }
}
```

- [ ] **Step 5: `e2e/components/CategoryRowComponent.ts`**

```ts
import type { Page, Locator } from '@playwright/test';

// A row in Settings → Categories editor, scoped by the category's current name.
export class CategoryRowComponent {
  readonly root: Locator;
  constructor(private page: Page, name: string) {
    // The row contains a delete button labelled "Delete {name}".
    this.root = page
      .locator('div.grid')
      .filter({ has: page.getByRole('button', { name: `Delete ${name}` }) })
      .first();
  }
  get nameInput(): Locator { return this.root.locator('input[type="text"]'); }
  get iconButton(): Locator { return this.root.getByRole('button', { name: /^Change icon for / }); }
  get deleteButton(): Locator { return this.root.getByRole('button', { name: /^Delete / }); }
  get dragHandle(): Locator { return this.root.getByRole('button', { name: /^Drag handle for / }); }

  async rename(next: string): Promise<void> {
    await this.nameInput.fill(next);
    await this.nameInput.blur();
  }
}
```

- [ ] **Step 6: `e2e/components/ThemeSwitcherComponent.ts`**

```ts
import type { Page, Locator } from '@playwright/test';
import type { SettingsPage } from '../pages/SettingsPage';

// Theme controls on the Settings page (radiogroups for mode + theme).
export class ThemeSwitcherComponent {
  constructor(private page: Page) {}
  get modeGroup(): Locator { return this.page.getByRole('radiogroup', { name: 'Color mode' }); }
  get themeGroup(): Locator { return this.page.getByRole('radiogroup', { name: 'Theme' }); }

  async setMode(mode: 'Light' | 'Dark'): Promise<void> {
    await this.modeGroup.getByRole('radio', { name: new RegExp(mode) }).click();
  }
  // Theme cards render a radio per theme; ThemeCard exposes an accessible name.
  async setTheme(theme: 'Peach' | 'Sage' | 'Lavender'): Promise<void> {
    await this.themeGroup.getByRole('radio', { name: new RegExp(theme, 'i') }).click();
  }
  // Reads the live theme attributes off <html>.
  async dataTheme(): Promise<string | null> {
    return this.page.locator('html').getAttribute('data-theme');
  }
  async dataMode(): Promise<string | null> {
    return this.page.locator('html').getAttribute('data-mode');
  }
  async cssVar(name: string): Promise<string> {
    return this.page.evaluate(
      (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim(),
      name,
    );
  }
}
```
> **Note for implementer:** Step 5 of Task 14 verifies the `ThemeCard` radio accessible names. Open `src/components/ThemeCard.tsx` during that task; if a theme card does not expose `role="radio"` with the theme name, the smallest fix is to locate by the theme label text instead — adjust `setTheme` accordingly. Do not change app behavior beyond what the spec's testid budget allows; prefer adjusting the locator.

- [ ] **Step 7: Verify typecheck**

Run: `npx tsc -p tsconfig.e2e.json --noEmit`
Expected: no error. (The `SettingsPage` import in Step 6 is type-only and resolves after Task 12; if it errors now, temporarily remove the unused import and re-add in Task 12. Simplest: drop the `SettingsPage` import — it is not used in the class body. Remove it.)

- [ ] **Step 8: Remove the unused import flagged above**

Delete the line `import type { SettingsPage } from '../pages/SettingsPage';` from `ThemeSwitcherComponent.ts` (it is unused; `noUnusedLocals` would flag it). Re-run `npx tsc -p tsconfig.e2e.json --noEmit` — expected clean.

- [ ] **Step 9: Commit**

```bash
git add e2e/components/
git commit -m "feat(e2e): component objects (header, toast, line-item, category, theme)"
```

---

## Task 12: Page objects

**Files:**
- Create: `e2e/pages/LoginPage.ts`
- Create: `e2e/pages/MfaChallengePage.ts`
- Create: `e2e/pages/DashboardPage.ts`
- Create: `e2e/pages/SettingsPage.ts`
- Create: `e2e/pages/InsightsPage.ts`

- [ ] **Step 1: `e2e/pages/LoginPage.ts`**

```ts
import type { Page, Locator } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}
  get email(): Locator { return this.page.getByPlaceholder('Email'); }
  get password(): Locator { return this.page.getByPlaceholder('Password'); }
  get submit(): Locator { return this.page.getByRole('button', { name: /log in/i }); }
  get error(): Locator { return this.page.locator('p.text-negative'); }

  async goto(): Promise<void> { await this.page.goto('/'); }
  async signIn(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
```

- [ ] **Step 2: `e2e/pages/MfaChallengePage.ts`**

```ts
import type { Page, Locator } from '@playwright/test';

export class MfaChallengePage {
  constructor(private page: Page) {}
  get heading(): Locator { return this.page.getByRole('heading', { name: 'Authenticator code' }); }
  get codeInput(): Locator { return this.page.getByPlaceholder('123456'); }
  get continueButton(): Locator { return this.page.getByRole('button', { name: /continue|verifying/i }); }
  get error(): Locator { return this.page.locator('p.text-negative'); }

  async submitCode(code: string): Promise<void> {
    await this.codeInput.fill(code);
    await this.continueButton.click();
  }
}
```

- [ ] **Step 3: `e2e/pages/DashboardPage.ts`**

```ts
import type { Page, Locator } from '@playwright/test';
import { HeaderComponent } from '../components/HeaderComponent';
import { ToastComponent } from '../components/ToastComponent';
import { CategoryTableComponent } from '../components/CategoryTableComponent';
import { LineItemRowComponent } from '../components/LineItemRowComponent';

export class DashboardPage {
  readonly header: HeaderComponent;
  readonly toast: ToastComponent;
  constructor(private page: Page) {
    this.header = new HeaderComponent(page);
    this.toast = new ToastComponent(page);
  }
  get projectedBalance(): Locator { return this.page.getByTestId('projected-balance'); }
  get actualBalance(): Locator { return this.page.getByTestId('actual-balance'); }

  async goto(): Promise<void> { await this.page.goto('/'); }
  categoryTable(categoryId: number): CategoryTableComponent {
    return new CategoryTableComponent(this.page, categoryId);
  }
  lineItem(itemId: number): LineItemRowComponent {
    return new LineItemRowComponent(this.page, itemId);
  }
}
```

- [ ] **Step 4: `e2e/pages/SettingsPage.ts`**

```ts
import type { Page, Locator } from '@playwright/test';
import { ThemeSwitcherComponent } from '../components/ThemeSwitcherComponent';
import { CategoryRowComponent } from '../components/CategoryRowComponent';

export class SettingsPage {
  readonly theme: ThemeSwitcherComponent;
  constructor(private page: Page) {
    this.theme = new ThemeSwitcherComponent(page);
  }
  get heading(): Locator { return this.page.getByRole('heading', { name: 'Appearance' }); }
  get backButton(): Locator { return this.page.getByRole('button', { name: /Back to budget/ }); }
  get addCategoryButton(): Locator { return this.page.getByRole('button', { name: '+ Add category' }); }
  get newCategoryInput(): Locator { return this.page.getByPlaceholder('New category name'); }
  get whatsNewButton(): Locator { return this.page.getByRole('button', { name: /What's new/ }); }

  categoryRow(name: string): CategoryRowComponent {
    return new CategoryRowComponent(this.page, name);
  }
  async addCategory(name: string): Promise<void> {
    await this.addCategoryButton.click();
    await this.newCategoryInput.fill(name);
    await this.newCategoryInput.press('Enter');
  }
  // Delete confirmation modal (custom role="dialog").
  deleteDialog(categoryName: string): Locator {
    return this.page.getByRole('dialog', { name: `Delete ${categoryName}` });
  }
}
```

- [ ] **Step 5: `e2e/pages/InsightsPage.ts`**

```ts
import type { Page, Locator } from '@playwright/test';

export class InsightsPage {
  constructor(private page: Page) {}
  get heading(): Locator { return this.page.getByRole('heading', { name: 'Insights' }); }
  get backButton(): Locator { return this.page.getByRole('button', { name: /Back to budget/ }); }
  get exportThisMonth(): Locator { return this.page.getByRole('button', { name: /Export this month/ }); }
  get exportAllHistory(): Locator { return this.page.getByRole('button', { name: /Export all history/ }); }

  chartRow(categoryId: number): Locator { return this.page.getByTestId(`chart-row-${categoryId}`); }
  // The amount summary in a chart row: "actual / projected", colored over/under.
  chartRowAmount(categoryId: number): Locator {
    return this.chartRow(categoryId).locator('span').nth(1);
  }
}
```

- [ ] **Step 6: Verify typecheck**

Run: `npx tsc -p tsconfig.e2e.json --noEmit`
Expected: no error.

- [ ] **Step 7: Commit**

```bash
git add e2e/pages/
git commit -m "feat(e2e): page objects (login, mfa, dashboard, settings, insights)"
```

---

## Task 13: Fixtures (`fixtures/console-guard.fixture.ts`, `fixtures/test.ts`)

**Files:**
- Create: `e2e/fixtures/console-guard.fixture.ts`
- Create: `e2e/fixtures/test.ts`

- [ ] **Step 1: `e2e/fixtures/console-guard.fixture.ts`**

```ts
import type { Page } from '@playwright/test';

// Known-benign noise; extend deliberately with a comment per entry.
const ALLOWLIST: RegExp[] = [
  /Download the React DevTools/i,
  /\[vite\]/i,
  /favicon\.ico/i, // dev server has no favicon
];

function allowed(text: string): boolean {
  return ALLOWLIST.some((re) => re.test(text));
}

export function installConsoleGuard(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !allowed(msg.text())) errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    if (!allowed(err.message)) errors.push(`pageerror: ${err.message}`);
  });
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText ?? '';
    if (!allowed(req.url()) && failure !== 'net::ERR_ABORTED') {
      errors.push(`requestfailed: ${req.url()} (${failure})`);
    }
  });
  return errors;
}
```

- [ ] **Step 2: `e2e/fixtures/test.ts`**

```ts
import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { MfaChallengePage } from '../pages/MfaChallengePage';
import { DashboardPage } from '../pages/DashboardPage';
import { SettingsPage } from '../pages/SettingsPage';
import { InsightsPage } from '../pages/InsightsPage';
import { installConsoleGuard } from './console-guard.fixture';
import { admin, getTestUserId } from '../support/supabaseAdmin';
import { env } from '../support/env';

type Fixtures = {
  loginPage: LoginPage;
  mfaPage: MfaChallengePage;
  dashboardPage: DashboardPage;
  settingsPage: SettingsPage;
  insightsPage: InsightsPage;
  consoleGuard: void;
  scopedData: ScopedData;
};

// Per-test factory: creates uniquely-named, self-owned entities via the service
// role and cleans them up in teardown (even on failure). Enables parallel
// mutating specs without touching baseline rows.
export class ScopedData {
  private categoryIds: number[] = [];
  constructor(private uid: string, private prefix: string) {}

  /** Create a uniquely-named category seeded with one line item in the given month.
   *  Returns { categoryId, itemId, itemProjected, itemActual }. */
  async createCategoryWithItem(opts: {
    periodMonth: string;
    itemName?: string;
    projected?: number;
    actual?: number;
  }): Promise<{ categoryId: number; itemId: number; projected: number; actual: number; categoryName: string }> {
    const categoryName = `${this.prefix} Cat`;
    const projected = opts.projected ?? 100;
    const actual = opts.actual ?? 60;
    const { data: cat, error: catErr } = await admin
      .from('categories')
      .insert({ user_id: this.uid, name: categoryName, icon: '🧪', display_order: 9000 })
      .select('id')
      .single();
    if (catErr) throw catErr;
    const categoryId = cat.id as number;
    this.categoryIds.push(categoryId);

    const { data: item, error: itemErr } = await admin
      .from('line_items')
      .insert({
        user_id: this.uid,
        category_id: categoryId,
        name: opts.itemName ?? `${this.prefix} Item`,
        projected,
        actual,
        period_month: opts.periodMonth,
      })
      .select('id')
      .single();
    if (itemErr) throw itemErr;

    return { categoryId, itemId: item.id as number, projected, actual, categoryName };
  }

  async createEmptyCategory(): Promise<{ categoryId: number; categoryName: string }> {
    const categoryName = `${this.prefix} Empty`;
    const { data, error } = await admin
      .from('categories')
      .insert({ user_id: this.uid, name: categoryName, icon: '🧪', display_order: 9001 })
      .select('id')
      .single();
    if (error) throw error;
    const categoryId = data.id as number;
    this.categoryIds.push(categoryId);
    return { categoryId, categoryName };
  }

  async cleanup(): Promise<void> {
    if (this.categoryIds.length === 0) return;
    // line_items first (FK ON DELETE RESTRICT), then categories.
    await admin.from('line_items').delete().in('category_id', this.categoryIds);
    await admin.from('categories').delete().in('id', this.categoryIds);
    this.categoryIds = [];
  }
}

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => { await use(new LoginPage(page)); },
  mfaPage: async ({ page }, use) => { await use(new MfaChallengePage(page)); },
  dashboardPage: async ({ page }, use) => { await use(new DashboardPage(page)); },
  settingsPage: async ({ page }, use) => { await use(new SettingsPage(page)); },
  insightsPage: async ({ page }, use) => { await use(new InsightsPage(page)); },

  consoleGuard: [
    async ({ page }, use) => {
      const errors = installConsoleGuard(page);
      await use();
      expect(errors, `Unexpected console/page/network errors:\n${errors.join('\n')}`).toEqual([]);
    },
    { auto: true },
  ],

  scopedData: async ({}, use, testInfo) => {
    const uid = await getTestUserId(env.E2E_USER_EMAIL);
    // Worker + test index keep names unique across parallel workers.
    const prefix = `E2E-w${testInfo.workerIndex}-${testInfo.testId.slice(0, 6)}`;
    const data = new ScopedData(uid, prefix);
    await use(data);
    await data.cleanup();
  },
});

export { expect };
```

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc -p tsconfig.e2e.json --noEmit`
Expected: no error.

- [ ] **Step 4: Commit**

```bash
git add e2e/fixtures/
git commit -m "feat(e2e): fixtures (page objects, scopedData, console guard)"
```

---

## Task 14: Spec — `auth-gate.e2e.ts` (@smoke)

**Files:**
- Create: `e2e/specs/auth-gate.e2e.ts`

> Drives the REAL login + TOTP UI from a clean (unauthenticated) state. Overrides the project's `storageState`. Covers the happy path and the wrong-code error.

- [ ] **Step 1: Write `e2e/specs/auth-gate.e2e.ts`**

```ts
import { test, expect } from '../fixtures/test';
import { generateTotp } from '../support/totp';
import { env } from '../support/env';

// This spec authenticates itself, so start from a blank session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('auth gate @smoke', () => {
  test('logs in and clears the TOTP challenge to reach the dashboard', async ({
    loginPage,
    mfaPage,
    dashboardPage,
  }) => {
    await loginPage.goto();
    await loginPage.signIn(env.E2E_USER_EMAIL, env.E2E_USER_PASSWORD);

    await expect(mfaPage.heading).toBeVisible();
    await mfaPage.submitCode(generateTotp(env.E2E_TOTP_SECRET));

    // Dashboard renders only when the AAL2-gated budget read succeeds.
    await expect(dashboardPage.projectedBalance).toBeVisible();
    await expect(dashboardPage.header.logoutButton).toBeVisible();
  });

  test('rejects a wrong TOTP code', async ({ loginPage, mfaPage }) => {
    await loginPage.goto();
    await loginPage.signIn(env.E2E_USER_EMAIL, env.E2E_USER_PASSWORD);

    await expect(mfaPage.heading).toBeVisible();
    await mfaPage.submitCode('000000');

    await expect(mfaPage.error).toBeVisible();
    // Still on the challenge screen.
    await expect(mfaPage.heading).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the spec**

Run:
```bash
npx playwright test e2e/specs/auth-gate.e2e.ts
```
Expected: PASS (2 tests, plus the `setup` dependency runs first). If the wrong-code test flakes because `000000` happens to be valid in a rare window, it will not — Supabase rejects mismatched codes deterministically.

- [ ] **Step 3: Commit**

```bash
git add e2e/specs/auth-gate.e2e.ts
git commit -m "test(e2e): auth gate smoke (login + TOTP + wrong code)"
```

---

## Task 15: Spec — `dashboard-crud.e2e.ts` (@smoke @regression)

**Files:**
- Create: `e2e/specs/dashboard-crud.e2e.ts`

> Uses `scopedData` to create a uniquely-named category with one known line item in the current month, then asserts **subtotal deltas** through the UI. Never touches baseline rows → parallel-safe.

- [ ] **Step 1: Write `e2e/specs/dashboard-crud.e2e.ts`**

```ts
import { test, expect } from '../fixtures/test';
import { MONTH_CURRENT } from '../data/baseline';

test.describe('dashboard CRUD @smoke @regression', () => {
  test('edits actual -> toast + balances/subtotal update', async ({ dashboardPage, scopedData }) => {
    const { categoryId, itemId, projected } = await scopedData.createCategoryWithItem({
      periodMonth: MONTH_CURRENT,
      projected: 100,
      actual: 60,
    });

    await dashboardPage.goto();
    const table = dashboardPage.categoryTable(categoryId);
    await expect(table.subtotal).toContainText('$60.00'); // actual side present

    await dashboardPage.lineItem(itemId).setActual(90);

    await expect(dashboardPage.toast.message).toBeVisible();
    // Subtotal now shows projected/actual = 100.00 / 90.00.
    await expect(table.subtotal).toContainText('$90.00');
    await expect(table.subtotal).toContainText(`$${projected.toFixed(2)}`);
  });

  test('adds an item -> subtotal increases by its projected', async ({ dashboardPage, scopedData }) => {
    const { categoryId } = await scopedData.createCategoryWithItem({
      periodMonth: MONTH_CURRENT,
      projected: 100,
      actual: 100,
    });

    await dashboardPage.goto();
    const table = dashboardPage.categoryTable(categoryId);
    await expect(table.subtotal).toContainText('$100.00');

    await table.addItem('Added Item', 25, 25);

    // New projected subtotal = 125.00.
    await expect(table.subtotal).toContainText('$125.00');
  });

  test('deletes an item via ✕→✓ -> subtotal drops', async ({ dashboardPage, scopedData }) => {
    const { categoryId, itemId } = await scopedData.createCategoryWithItem({
      periodMonth: MONTH_CURRENT,
      projected: 40,
      actual: 40,
    });

    await dashboardPage.goto();
    const table = dashboardPage.categoryTable(categoryId);
    await expect(table.subtotal).toContainText('$40.00');

    await dashboardPage.lineItem(itemId).delete();

    // Category now has zero items; it collapses to the empty card (no subtotal).
    await expect(dashboardPage.page.getByTestId(`subtotal-${categoryId}`)).toHaveCount(0);
  });
});
```
> **Implementer note:** `dashboardPage.page` is private in the class as written. Either expose a public `get page()` getter on `DashboardPage`, or assert via a fresh `page` fixture param. Simplest: add `dashboardPage` an accessor — in `DashboardPage`, change `constructor(private page: Page)` to `constructor(public readonly page: Page)`. Make that one-line change in `e2e/pages/DashboardPage.ts` as part of this task, then re-run typecheck.

- [ ] **Step 2: Apply the `DashboardPage.page` visibility fix**

In `e2e/pages/DashboardPage.ts`, change `constructor(private page: Page)` to `constructor(public readonly page: Page)`. Run `npx tsc -p tsconfig.e2e.json --noEmit` — expected clean.

- [ ] **Step 3: Run the spec**

Run:
```bash
npx playwright test e2e/specs/dashboard-crud.e2e.ts
```
Expected: PASS (3 tests). If the add-item draft does not commit, confirm `draftName.press('Enter')` (DraftRow finalizes on Enter).

- [ ] **Step 4: Commit**

```bash
git add e2e/specs/dashboard-crud.e2e.ts e2e/pages/DashboardPage.ts
git commit -m "test(e2e): dashboard CRUD (edit/add/delete subtotal deltas)"
```

---

## Task 16: Spec — `categories-editor.e2e.ts` (@regression)

**Files:**
- Create: `e2e/specs/categories-editor.e2e.ts`

> Operates only on self-created categories via `scopedData`. Covers rename (persists after reload), add, and emoji pick. Reorder is asserted on two self-created categories; if it proves flaky under parallelism, mark this file serial (documented fallback below).

- [ ] **Step 1: Write `e2e/specs/categories-editor.e2e.ts`**

```ts
import { test, expect } from '../fixtures/test';
import { MONTH_CURRENT } from '../data/baseline';

test.describe('categories editor @regression', () => {
  test('renames a category and it persists after reload', async ({
    dashboardPage,
    settingsPage,
    scopedData,
  }) => {
    const { categoryName } = await scopedData.createCategoryWithItem({ periodMonth: MONTH_CURRENT });
    const renamed = `${categoryName} Renamed`;

    await dashboardPage.goto();
    await dashboardPage.header.openSettings();
    await expect(settingsPage.heading).toBeVisible();

    await settingsPage.categoryRow(categoryName).rename(renamed);
    await expect(settingsPage.page.getByRole('button', { name: `Delete ${renamed}` })).toBeVisible();

    // Persisted server-side: reload and re-open Settings.
    await settingsPage.page.reload();
    await dashboardPage.header.openSettings();
    await expect(settingsPage.page.getByRole('button', { name: `Delete ${renamed}` })).toBeVisible();
  });

  test('adds a new category', async ({ dashboardPage, settingsPage, scopedData }) => {
    // Use scopedData only to namespace + auto-clean: we add via the UI, then
    // register the created id for cleanup by querying it back.
    const name = `E2E Added ${test.info().testId.slice(0, 6)}`;

    await dashboardPage.goto();
    await dashboardPage.header.openSettings();
    await settingsPage.addCategory(name);

    await expect(settingsPage.page.getByRole('button', { name: `Delete ${name}` })).toBeVisible();

    // Clean up the UI-created category through scopedData's admin client.
    await scopedData.cleanupByCategoryName(name);
  });

  test('changes a category icon via the emoji picker', async ({
    dashboardPage,
    settingsPage,
    scopedData,
  }) => {
    const { categoryName } = await scopedData.createCategoryWithItem({ periodMonth: MONTH_CURRENT });

    await dashboardPage.goto();
    await dashboardPage.header.openSettings();

    const row = settingsPage.categoryRow(categoryName);
    await row.iconButton.click();
    const picker = settingsPage.page.getByRole('dialog', { name: 'Pick an emoji' });
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: '🍔' }).click();

    await expect(row.iconButton).toContainText('🍔');
  });
});
```
> **Implementer notes:**
> - `settingsPage.page` must be public — apply the same `public readonly page` fix to `SettingsPage` (change `constructor(private page: Page)` → `constructor(public readonly page: Page)`).
> - Add a `cleanupByCategoryName(name: string)` method to `ScopedData` (Step 2) so the UI-created category is removed.

- [ ] **Step 2: Extend `ScopedData` + make `SettingsPage.page` public**

In `e2e/fixtures/test.ts`, add this method to the `ScopedData` class:
```ts
  /** Register + remove a category created through the UI, by its name. */
  async cleanupByCategoryName(name: string): Promise<void> {
    const { data } = await admin
      .from('categories')
      .select('id')
      .eq('user_id', this.uid)
      .eq('name', name);
    const ids = (data ?? []).map((c) => c.id as number);
    if (ids.length === 0) return;
    await admin.from('line_items').delete().in('category_id', ids);
    await admin.from('categories').delete().in('id', ids);
  }
```
In `e2e/pages/SettingsPage.ts`, change `constructor(private page: Page)` → `constructor(public readonly page: Page)`. Run `npx tsc -p tsconfig.e2e.json --noEmit` — expected clean.

- [ ] **Step 3: Run the spec**

Run:
```bash
npx playwright test e2e/specs/categories-editor.e2e.ts
```
Expected: PASS (3 tests).

- [ ] **Step 4: (Conditional) serial fallback**

Only if the file shows flakiness across repeated runs (`npx playwright test e2e/specs/categories-editor.e2e.ts --repeat-each=5`), add at the top of the describe block:
```ts
test.describe.configure({ mode: 'serial' });
```
Document why in a comment. Skip this step if 5x repeat is green.

- [ ] **Step 5: Commit**

```bash
git add e2e/specs/categories-editor.e2e.ts e2e/fixtures/test.ts e2e/pages/SettingsPage.ts
git commit -m "test(e2e): categories editor (rename/add/icon)"
```

---

## Task 17: Spec — `insights-export.e2e.ts` (@regression)

**Files:**
- Create: `e2e/specs/insights-export.e2e.ts`

> Read-only against the baseline. Asserts bar colors (Services over=red, Entertainment under=green), the export filename, and the CSV header line. Resolves baseline category ids via `categoryIdByName`.

- [ ] **Step 1: Write `e2e/specs/insights-export.e2e.ts`**

```ts
import { test, expect } from '../fixtures/test';
import { categoryIdByName } from '../support/seed';
import {
  JUNE_SERVICES_ACTUAL,
  JUNE_SERVICES_PROJECTED,
  JUNE_ENTERTAINMENT_ACTUAL,
} from '../data/baseline';

test.describe('insights + export @regression', () => {
  test('charts baseline categories with correct over/under colors', async ({
    dashboardPage,
    insightsPage,
  }) => {
    const servicesId = await categoryIdByName('Services');
    const entertainmentId = await categoryIdByName('Entertainment');

    await dashboardPage.goto();
    await dashboardPage.header.openInsights();
    await expect(insightsPage.heading).toBeVisible();

    // Services is over budget -> amount text is red (text-negative).
    const services = insightsPage.chartRowAmount(servicesId);
    await expect(services).toHaveClass(/text-negative/);
    await expect(services).toContainText(`$${JUNE_SERVICES_ACTUAL.toFixed(2)}`);
    await expect(services).toContainText(`$${JUNE_SERVICES_PROJECTED.toFixed(2)}`);

    // Entertainment is under budget -> green (text-positive).
    const entertainment = insightsPage.chartRowAmount(entertainmentId);
    await expect(entertainment).toHaveClass(/text-positive/);
    await expect(entertainment).toContainText(`$${JUNE_ENTERTAINMENT_ACTUAL.toFixed(2)}`);
  });

  test('exports this month as a CSV with the expected filename + header', async ({
    dashboardPage,
    insightsPage,
  }) => {
    await dashboardPage.goto();
    await dashboardPage.header.openInsights();
    await expect(insightsPage.heading).toBeVisible();

    const downloadPromise = insightsPage.page.waitForEvent('download');
    await insightsPage.exportThisMonth.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('budget-2026-06.csv');

    const stream = await download.createReadStream();
    const text = await streamToString(stream);
    const firstLine = text.split('\r\n')[0];
    expect(firstLine).toBe('Month,Category,Item,Projected,Actual');
    expect(text).toContain('Services,Internet');
  });

  test('exports all history', async ({ dashboardPage, insightsPage }) => {
    await dashboardPage.goto();
    await dashboardPage.header.openInsights();

    const downloadPromise = insightsPage.page.waitForEvent('download');
    await insightsPage.exportAllHistory.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('budget-all-history.csv');
  });
});

import type { Readable } from 'node:stream';
async function streamToString(stream: Readable | null): Promise<string> {
  if (!stream) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf-8');
}
```
> **Implementer note:** `insightsPage.page` must be public — apply `public readonly page` to `InsightsPage` (change `constructor(private page: Page)` → `constructor(public readonly page: Page)`). Move the `import type { Readable }` to the top of the file if your lint config forbids mid-file imports (functionally identical).

- [ ] **Step 2: Make `InsightsPage.page` public + tidy imports**

In `e2e/pages/InsightsPage.ts`, change `constructor(private page: Page)` → `constructor(public readonly page: Page)`. Move the `import type { Readable } from 'node:stream';` line to the top of `insights-export.e2e.ts`. Run `npx tsc -p tsconfig.e2e.json --noEmit` — expected clean.

- [ ] **Step 3: Run the spec**

Run:
```bash
npx playwright test e2e/specs/insights-export.e2e.ts
```
Expected: PASS (3 tests). If `chartRowAmount` targets the wrong span, inspect `ProjectedVsActualChart.tsx`: the colored amount is the second `<span>` inside the flex header — adjust `.nth(1)` if needed.

- [ ] **Step 4: Commit**

```bash
git add e2e/specs/insights-export.e2e.ts e2e/pages/InsightsPage.ts
git commit -m "test(e2e): insights chart colors + CSV export"
```

---

## Task 18: Spec — `theme-switching.e2e.ts` (@regression @a11y)

**Files:**
- Create: `e2e/specs/theme-switching.e2e.ts`

> Toggles mode + cycles themes via Settings, asserts `data-theme`/`data-mode` on `<html>` and a changed `--bg` CSS var, verifies persistence after reload, and runs an axe WCAG smoke on Settings.

- [ ] **Step 1: Write `e2e/specs/theme-switching.e2e.ts`**

```ts
import { test, expect } from '../fixtures/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('theme switching @regression @a11y', () => {
  test('toggles mode + theme and persists across reload', async ({ dashboardPage, settingsPage }) => {
    await dashboardPage.goto();
    await dashboardPage.header.openSettings();
    await expect(settingsPage.heading).toBeVisible();

    const theme = settingsPage.theme;
    const startBg = await theme.cssVar('--bg');

    await theme.setMode('Dark');
    await expect(settingsPage.page.locator('html')).toHaveAttribute('data-mode', 'dark');
    const darkBg = await theme.cssVar('--bg');
    expect(darkBg).not.toBe(startBg);

    await theme.setTheme('Sage');
    await expect(settingsPage.page.locator('html')).toHaveAttribute('data-theme', 'sage');

    // Persisted server-side: reload, re-open Settings, attributes survive.
    await settingsPage.page.reload();
    await dashboardPage.header.openSettings();
    await expect(settingsPage.page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await expect(settingsPage.page.locator('html')).toHaveAttribute('data-theme', 'sage');
  });

  test('Settings has no serious/critical accessibility violations', async ({
    dashboardPage,
    settingsPage,
  }) => {
    await dashboardPage.goto();
    await dashboardPage.header.openSettings();
    await expect(settingsPage.heading).toBeVisible();

    const results = await new AxeBuilder({ page: settingsPage.page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(seriousOrCritical, JSON.stringify(seriousOrCritical, null, 2)).toEqual([]);
  });
});
```
> **Implementer note (theme persistence + parallelism):** this spec mutates the user's global theme preference. If it runs concurrently with another spec that reads theme, it could interfere. Theme is global (not month/category scoped), so mark this file serial relative to itself is not enough. Mitigation: the only other specs touching theme are none (CRUD/categories/insights don't read `data-theme`). Leave parallel; if a future spec reads theme, revisit. Restore default at teardown is optional — the next run's `setup` reseed does not reset preferences, so add an `afterEach` that sets mode→light, theme→peach via the UI is NOT required for the current suite. Document this in the README.

- [ ] **Step 2: Verify `ThemeCard` radio accessible names**

Open `src/components/ThemeCard.tsx`. Confirm each card renders with `role="radio"` and an accessible name containing the theme word (Peach/Sage/Lavender). If it does NOT expose `role="radio"` with that name, update `ThemeSwitcherComponent.setTheme` to locate the card by its visible label text instead (e.g. `this.themeGroup.getByText(new RegExp(theme, 'i')).click()`). Make the minimal locator change; do not alter app behavior.

- [ ] **Step 3: Run the spec**

Run:
```bash
npx playwright test e2e/specs/theme-switching.e2e.ts
```
Expected: PASS (2 tests). If axe reports a pre-existing serious/critical violation, capture it, and add a narrowly-scoped, commented allowlist (e.g. `.disableRules(['color-contrast'])`) ONLY for the specific known issue — note it in the README and the deferred list. Do not broadly disable.

- [ ] **Step 4: Commit**

```bash
git add e2e/specs/theme-switching.e2e.ts e2e/components/ThemeSwitcherComponent.ts
git commit -m "test(e2e): theme switching + Settings a11y smoke"
```

---

## Task 19: CI job, README, and full-suite verification

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `e2e/README.md`

- [ ] **Step 1: Add the `e2e` job to `.github/workflows/ci.yml`**

Append a second job (keep the existing `test` job unchanged):

```yaml
  e2e:
    runs-on: ubuntu-latest
    # Serialize against the shared QA test user across concurrent runs.
    concurrency:
      group: e2e-${{ github.ref }}
      cancel-in-progress: false
    env:
      CI: 'true'
      VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
      VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      E2E_USER_EMAIL: ${{ secrets.E2E_USER_EMAIL }}
      E2E_USER_PASSWORD: ${{ secrets.E2E_USER_PASSWORD }}
      E2E_TOTP_SECRET: ${{ secrets.E2E_TOTP_SECRET }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browser
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload report + artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: |
            playwright-report/
            test-results/
            results.xml
          retention-days: 7
```

- [ ] **Step 2: Write `e2e/README.md`**

```markdown
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
  Read-only specs (insights, theme) assert against it.
- **Mutating specs** (dashboard, categories) use the `scopedData` fixture to create
  uniquely-named, self-owned entities and clean them up — safe under `fullyParallel`.
- The **console guard** fails any test on an unexpected `console.error` / `pageerror` /
  failed request (allowlist in `fixtures/console-guard.fixture.ts`).

## Notes / gotchas

- E2E hits the **real QA backend** — placeholder env values won't work (unlike the unit-test CI job).
- The service-role key is **test infra only**; never import `support/supabaseAdmin.ts` from `src/`.
- The theme spec mutates the user's global theme preference and does not restore it; the next
  `setup` run does not reset preferences, so the last-set theme persists between runs (harmless).
- Reading traces: failures in CI upload `playwright-report/` + `test-results/` (traces/video).
  Locally, re-run with `--trace on` then `npm run e2e:report`.
```

- [ ] **Step 3: Typecheck everything (app + e2e)**

Run:
```bash
npm run typecheck && npm run e2e:typecheck && npm test
```
Expected: app typecheck clean, e2e typecheck clean, unit suite green (99).

- [ ] **Step 4: Run the FULL E2E suite locally**

Run:
```bash
npm run e2e
```
Expected: `setup` runs once, then all 5 spec files pass (auth-gate 2, dashboard-crud 3, categories-editor 3, insights-export 3, theme-switching 2 = 13 tests). Run twice to confirm idempotency (the reseed makes re-runs deterministic).

- [ ] **Step 5: Confirm smoke subset runs**

Run:
```bash
npm run e2e:smoke
```
Expected: only `@smoke` tests run (auth-gate 2 + dashboard-crud edit test... note dashboard-crud is tagged `@smoke @regression` at the describe level, so all 3 run). Confirms grep tagging works.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml e2e/README.md
git commit -m "ci(e2e): add Playwright job + e2e README"
```

- [ ] **Step 7: Push to staging**

```bash
git push origin staging
```
> If the auto-mode security classifier flags the push to `staging`, treat it as the known false positive (see CLAUDE.md) — re-issue from the parent session or push manually.

- [ ] **Step 8: Verify CI**

After the push, confirm the GitHub Actions `e2e` job goes green (the secrets from Task 7 must be set). If it fails on missing secrets, the user must add them before CI can pass.

---

## Self-review (completed during planning)

**Spec coverage check** — every spec section maps to a task:
- POM / component objects → Tasks 11, 12. No assertions in page objects ✓ (assertions only in specs).
- Fixtures (page objects, scopedData, consoleGuard) → Task 13. storageState via setup project, not a fixture ✓.
- Locator strategy (role/label-first, minimal testids) → Task 10 (testids) + role-based locators throughout 11/12.
- Auth setup project + storageState → Tasks 8 (config) + 9 (setup). `auth-gate` overrides storageState ✓ (Task 14).
- Test data isolation (baseline read-only; scopedData mutating deltas) → Tasks 5, 6, 13, 15, 16.
- Reorder global-order caveat + serial fallback → Task 16 Step 4 (conditional).
- Web-first assertions, no sleeps → all specs use `expect(...)` auto-retry ✓.
- Determinism/retries/forbidOnly → Task 8 config.
- Accessibility (axe on Settings) → Task 18. (Spec mentions Login/Dashboard/Insights too; current plan covers Settings as the @a11y anchor. Additional pages can be added later — noted as a deliberate, documented narrowing, not a gap that blocks the suite.)
- Tagging + selective runs → Tasks 14–18 tags + Task 1 `e2e:smoke` script + Task 19 Step 5 verification.
- Env config (fail-fast) → Task 2.
- Auth provisioning (one-time) → Task 7.
- First suite (5 specs) → Tasks 14–18.
- Playwright config → Task 8.
- CI integration → Task 19.
- Secrets → Task 1 (`.env.e2e.local.example`) + Task 7 + Task 19 env block.
- Tooling (tsconfig.e2e, gitignore, README) → Tasks 1, 19.

**Deliberate refinements vs spec (documented):**
- Auth setup drives the real UI to capture `storageState` (spec described it more programmatically); this is the robust, canonical pattern and still uses `otplib` for the code.
- `scopedData` seeds a category **with one item** (and returns ids) for stable subtotal-delta assertions, avoiding the empty-card branch and unknown new-row ids.
- a11y axe anchored on Settings (the theme spec's page); other pages deferred to keep the first suite focused — explicitly noted, not silently dropped.

**Placeholder scan:** none — every code step contains complete code.

**Type consistency:** `ScopedData.createCategoryWithItem` returns `{ categoryId, itemId, projected, actual, categoryName }` and specs destructure exactly those; `categoryIdByName` / `categoryTable(id)` / `lineItem(id)` / `chartRow(id)` signatures are consistent across tasks. `public readonly page` fixes are applied to `DashboardPage`/`SettingsPage`/`InsightsPage` in the tasks that first need them.
