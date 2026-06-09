import { test, expect } from '../fixtures/test';
import { generateTotp } from '../support/totp';
import { env } from '../support/env';

// This spec authenticates itself, so start from a blank session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('auth gate @smoke', () => {
  // Serial: both tests do a fresh sign-in + MFA verify on the shared test user.
  // Running them concurrently pressures Supabase's MFA verify endpoint and can
  // return 403 (rate/lock) instead of the expected 422, causing flakiness.
  test.describe.configure({ mode: 'serial' });

  test('logs in and clears the TOTP challenge to reach the dashboard', async ({
    loginPage,
    mfaPage,
    dashboardPage,
  }) => {
    await loginPage.goto();
    await loginPage.signIn(env.E2E_USER_EMAIL, env.E2E_USER_PASSWORD);

    await expect(mfaPage.heading).toBeVisible();

    // factorId loads async; retry with a fresh code until the AAL2 dashboard renders.
    await expect(async () => {
      if (await dashboardPage.projectedBalance.isVisible()) return;
      if (await mfaPage.codeInput.isVisible()) {
        await mfaPage.submitCode(generateTotp(env.E2E_TOTP_SECRET));
      }
      await expect(dashboardPage.projectedBalance).toBeVisible({ timeout: 4000 });
    }).toPass({ timeout: 30_000 });

    await expect(dashboardPage.header.logoutButton).toBeVisible();
  });

  test('rejects a wrong TOTP code', async ({ loginPage, mfaPage }) => {
    // Deliberately triggers MFA verify error responses (422, or 403 under
    // rate-limit) — opt out of the console guard for this negative test.
    test.info().annotations.push({ type: 'no-console-guard' });

    await loginPage.goto();
    await loginPage.signIn(env.E2E_USER_EMAIL, env.E2E_USER_PASSWORD);

    await expect(mfaPage.heading).toBeVisible();

    // Retry the wrong-code submit until the factor has loaded and an error shows.
    await expect(async () => {
      await mfaPage.submitCode('000000');
      await expect(mfaPage.error).toBeVisible({ timeout: 4000 });
    }).toPass({ timeout: 30_000 });

    // Still on the challenge screen.
    await expect(mfaPage.heading).toBeVisible();
  });
});
