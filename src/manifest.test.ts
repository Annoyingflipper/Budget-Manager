import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

  it('ships an initial theme-color for ThemeProvider to update', () => {
    expect(html).toMatch(/<meta name="theme-color" content="#fef3ec"/);
  });

  it('no longer calls the app Budget Manager', () => {
    expect(html).not.toMatch(/Budget Manager/);
  });
});
