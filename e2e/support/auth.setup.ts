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
