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

  // 3. TOTP challenge. MFAChallenge loads its factorId via an async listFactors()
  //    after the screen renders; a submit that fires before it resolves silently
  //    no-ops (submit() early-returns on null factorId). Retry with a fresh code
  //    until the dashboard renders — also dodges the 30s TOTP window boundary.
  const codeInput = page.getByPlaceholder('123456');
  const dashboard = page.getByTestId('projected-balance');
  await expect(codeInput).toBeVisible();

  await expect(async () => {
    if (await dashboard.isVisible()) return;
    if (await codeInput.isVisible()) {
      await codeInput.fill(generateTotp(env.E2E_TOTP_SECRET));
      await page.getByRole('button', { name: /continue|verifying/i }).click();
    }
    // 4. Dashboard renders only at AAL2 (RLS-gated budget read succeeded).
    await expect(dashboard).toBeVisible({ timeout: 4000 });
  }).toPass({ timeout: 30_000 });

  // 5. Persist the authenticated, AAL2 storage state.
  await page.context().storageState({ path: STORAGE_STATE });
});
