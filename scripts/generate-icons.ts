/**
 * Renders public/icon.svg to the PNG sizes Chrome and iOS need.
 *
 * Run manually via `npm run icons`; outputs are committed. This is not part
 * of the build — using Playwright (already a devDependency) keeps an image
 * library out of the dependency tree for a script that runs rarely.
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(resolve(root, 'public/icon.svg'), 'utf8');

type Target = { file: string; size: number; padding: number };

const TARGETS: Target[] = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0 },
  { file: 'favicon-32.png', size: 32, padding: 0 },
  // Maskable icons are cropped to a platform-chosen shape. The safe zone is
  // the centre 80%, so the art is inset by 10% on each side to guarantee a
  // circular mask cannot clip the coin stack.
  { file: 'icon-maskable-512.png', size: 512, padding: 0.1 },
];

const browser = await chromium.launch();
try {
  for (const { file, size, padding } of TARGETS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const inset = Math.round(size * padding);
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:#fef3ec">
         <div style="width:${size}px;height:${size}px;padding:${inset}px;box-sizing:border-box">
           <div style="width:100%;height:100%">${svg
             .replace(/width="64"/, 'width="100%"')
             .replace(/height="64"/, 'height="100%"')}</div>
         </div>
       </body></html>`,
    );
    const buffer = await page.screenshot({ omitBackground: false });
    writeFileSync(resolve(root, 'public', file), buffer);
    await page.close();
    console.log(`wrote public/${file} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
