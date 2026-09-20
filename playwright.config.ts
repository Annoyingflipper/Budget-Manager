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
      // Month-mutating specs run separately — see below.
      testIgnore: /(delete-month|rollover)\.e2e\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
    },
    {
      // All specs share one QA test user, and the app opens on the latest month
      // that has data. Any spec that creates or removes a month silently changes
      // what every other spec sees, and `fullyParallel` is on — so the two specs
      // that do that run in their own projects, CHAINED, after everything else.
      //
      // Why chained and not one shared project: `fullyParallel` applies inside a
      // project too, so putting both in one still let them run concurrently with
      // each other — and they both operate on MONTH_CURRENT + 1. That failed
      // immediately and explicitly: delete-month asserted the future month was
      // empty and found rollover's four rows sitting in it.
      //
      // delete-month was separated first (it's what made the CSV export spec
      // flaky). rollover joined later, after three consecutive full runs each
      // failed a DIFFERENT spec — receipts, expense-currency, paid-dates — with
      // every one passing when re-run alone. It had been serialized inside
      // due-dates.e2e.ts, which serialized it against that file's own tests but
      // not against other FILES; for the seconds it held MONTH_CURRENT + 1 open,
      // any spec navigating on another worker asserted against the wrong month.
      //
      // Do not merge these two back together, and do not move either into the
      // parallel 'chromium' project.
      name: 'chromium-rollover',
      testMatch: /rollover\.e2e\.ts/,
      dependencies: ['chromium'],
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
    },
    {
      name: 'chromium-delete-month',
      testMatch: /delete-month\.e2e\.ts/,
      dependencies: ['chromium-rollover'],
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
