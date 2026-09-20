import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { THEME_BG } from './theme/themeColors';

const root = resolve(__dirname, '..');
const manifest = JSON.parse(
  readFileSync(resolve(root, 'public/manifest.webmanifest'), 'utf8'),
);

describe('web app manifest', () => {
  it('declares the app name', () => {
    expect(manifest.name).toBe('Mesada');
    expect(manifest.short_name).toBe('Mesada');
  });

  it('pins an explicit id so the app identity cannot drift', () => {
    expect(manifest.id).toBe('/');
  });

  it('satisfies Chrome installability: start_url and standalone display', () => {
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  it('does not defer to a related native app', () => {
    expect(manifest.prefer_related_applications ?? false).toBe(false);
  });

  it('declares both a 192px and a 512px icon, as Chrome requires', () => {
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('declares a maskable icon so platform masking cannot clip the mark', () => {
    const maskable = manifest.icons.filter((i: { purpose?: string }) =>
      i.purpose?.split(' ').includes('maskable'),
    );
    expect(maskable.length).toBeGreaterThan(0);
  });

  it('points every declared icon at a file that exists', () => {
    for (const icon of manifest.icons as { src: string }[]) {
      const path = resolve(root, 'public', icon.src.replace(/^\//, ''));
      expect(existsSync(path), `missing icon file: ${icon.src}`).toBe(true);
    }
  });

  it('scopes the app to the whole origin', () => {
    expect(manifest.scope).toBe('/');
  });

  // Derived from THEME_BG rather than hardcoded: themeColors.test.ts already
  // fails and forces THEME_BG to update if --bg ever changes in themes.css,
  // but a literal here would keep passing and certify a now-stale manifest/
  // index.html. Pinning to THEME_BG.peach.light means this test only passes
  // when the manifest and index.html actually track the CSS source of truth.
  it('theme_color and background_color match the peach/light background', () => {
    expect(manifest.theme_color).toBe(THEME_BG.peach.light);
    expect(manifest.background_color).toBe(THEME_BG.peach.light);
  });
});

describe('index.html', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');

  it('is titled Mesada', () => {
    expect(html).toMatch(/<title>Mesada<\/title>/);
  });

  it('links the manifest', () => {
    expect(html).toMatch(/rel="manifest"[^>]*href="\/manifest\.webmanifest"/);
  });

  it('declares an apple-touch-icon for iOS home screens', () => {
    expect(html).toMatch(/rel="apple-touch-icon"/);
  });

  it('ships an initial theme-color matching THEME_BG.peach.light for ThemeProvider to update', () => {
    // See the comment on the manifest theme_color/background_color test
    // above: derived from THEME_BG, not hardcoded, so a --bg change in
    // themes.css that themeColors.test.ts forces into THEME_BG also forces
    // this test to catch a stale index.html rather than keep passing.
    expect(html).toMatch(
      new RegExp(`<meta name="theme-color" content="${THEME_BG.peach.light}"`),
    );
  });

  it('no longer calls the app Budget Manager', () => {
    expect(html).not.toMatch(/Budget Manager/);
  });
});
