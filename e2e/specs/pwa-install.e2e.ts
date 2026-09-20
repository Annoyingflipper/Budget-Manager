import { test, expect } from '../fixtures/test';

test.describe('PWA installability @smoke', () => {
  test('serves a manifest that satisfies Chrome install criteria', async ({ page }) => {
    const res = await page.request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);

    const manifest = await res.json();
    expect(manifest.name).toBe('Mesada');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');

    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  test('every icon the manifest declares is actually served', async ({ page }) => {
    const manifest = await (await page.request.get('/manifest.webmanifest')).json();
    const icons = manifest.icons as { src: string; type: string }[];
    expect(icons?.length ?? 0, 'manifest declares no icons at all').toBeGreaterThan(0);

    // Expected content-type substring per declared MIME type. An icon type not
    // listed here should fail loudly rather than being silently assumed to be
    // a PNG (see task-8 review, Finding 2).
    const expectedSubstringByType: Record<string, string> = {
      'image/svg+xml': 'svg',
      'image/png': 'png',
    };

    for (const icon of icons) {
      const expectedSubstring = expectedSubstringByType[icon.type];
      expect(expectedSubstring, `${icon.src} declares unrecognised type ${icon.type}`).toBeDefined();

      const res = await page.request.get(icon.src);
      expect(res.status(), `${icon.src} should be served`).toBe(200);
      expect(res.headers()['content-type'], `${icon.src} content type`)
        .toContain(expectedSubstring);
    }
  });

  test('the document links the manifest and is titled Mesada', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Mesada');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/manifest.webmanifest');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  });

  test('theme-color is present for the installed window title bar', async ({ page }) => {
    await page.goto('/');
    const content = await page
      .locator('meta[name="theme-color"]')
      .getAttribute('content');
    expect(content).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
