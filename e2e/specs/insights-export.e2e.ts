import type { Readable } from 'node:stream';
import { test, expect } from '../fixtures/test';
import { categoryIdByName } from '../support/seed';
import {
  JUNE_SERVICES_ACTUAL,
  JUNE_SERVICES_PROJECTED,
  JUNE_ENTERTAINMENT_ACTUAL,
} from '../data/baseline';

async function streamToString(stream: Readable | null): Promise<string> {
  if (!stream) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf-8');
}

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

    const text = await streamToString(await download.createReadStream());
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
