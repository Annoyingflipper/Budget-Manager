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
