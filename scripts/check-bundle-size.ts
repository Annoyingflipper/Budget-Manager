/**
 * Post-build gate. Three jobs:
 *
 *   1. Keep the pre-first-paint JS payload under budget. `dist/index.html`
 *      loads more than just the entry chunk before first paint: it also
 *      `modulepreload`s @supabase/supabase-js (Rollup names this chunk
 *      `currency-*` by an alphabetical heuristic — the name is misleading,
 *      it has nothing to do with the currency feature). Both are fetched
 *      together, so BOTH count toward the critical path. Measuring only
 *      the entry chunk would misreport the real number and let the
 *      preloaded chunk grow without limit — a ratchet guarding a number
 *      nobody actually waits on.
 *
 *      Pre-v2.1 baseline: a single 494.72 kB chunk (138.15 kB gzipped),
 *      no code splitting. v2.1 split the bundle and brought the critical
 *      path (entry + preloaded supabase chunk) down to 131.54 kB gzipped
 *      (a 6.63 kB saving over the old single-chunk total), plus deferred
 *      ~20.6 kB gzipped of route code (Settings/Insights/Accounts) that
 *      now only loads if the user opens those pages.
 *
 *   2. Prove the manifest and every icon it declares actually reached
 *      dist/, and that every icon dist/index.html links to directly
 *      (apple-touch-icon.png, favicon-32.png — neither is in
 *      manifest.icons) reached dist/ too. This is the only check in the
 *      suite that inspects Vercel's real build output — the Vitest suite
 *      reads public/ from disk, and the Playwright suite reads a dev
 *      server. Without this, public/ silently failing to copy would reach
 *      production with everything green.
 *
 *   3. Prove the typography scale in src/tokens.css actually compiles the
 *      way it claims. src/theme/tokens.test.ts only regexes tokens.css'
 *      source text — that proves the file *says* the right things, never
 *      that Tailwind *does* the right thing with them. That gap is exactly
 *      how text-money's tabular numerals shipped silently broken: Tailwind
 *      4 only wires up --line-height / --letter-spacing / --font-weight as
 *      --text-* theme-key suffixes, so a --font-variant-numeric suffix
 *      compiled to a dangling custom property nothing read, and every
 *      source-text test still passed. This section reads the real emitted
 *      CSS instead, the same way section 1 reads real emitted JS.
 *
 * Not a Vitest test: `npm test` runs before `npm run build` in both CI and
 * vercel.json, so dist/ does not exist yet at that point. A Vitest test
 * here would fail spuriously or silently skip.
 *
 * To raise MAX_CRITICAL_PATH_GZIP_KB, do it deliberately and say why in
 * the commit message. Deleting this check is not how you make it pass.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_CRITICAL_PATH_GZIP_KB = 135;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

if (!existsSync(dist)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const failures: string[] = [];

// 1. Critical-path JS: every module-script src and every modulepreload href
//    referenced by dist/index.html — that's everything the browser fetches
//    before first paint.
const indexHtmlPath = resolve(dist, 'index.html');
if (!existsSync(indexHtmlPath)) {
  failures.push('dist/index.html is missing');
} else {
  const html = readFileSync(indexHtmlPath, 'utf8');

  const criticalPaths = new Set<string>();

  // <script type="module" ... src="/assets/xyz.js">
  for (const m of html.matchAll(/<script\b[^>]*\btype=["']module["'][^>]*>/gi)) {
    const src = m[0].match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (src) criticalPaths.add(src);
  }

  // <link rel="modulepreload" ... href="/assets/xyz.js">
  for (const m of html.matchAll(/<link\b[^>]*\brel=["']modulepreload["'][^>]*>/gi)) {
    const href = m[0].match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href) criticalPaths.add(href);
  }

  if (criticalPaths.size === 0) {
    failures.push('no <script type="module"> or modulepreload links found in dist/index.html');
  } else {
    let totalGzipKb = 0;
    console.log('Critical-path JS (script + modulepreload) in dist/index.html:');
    for (const p of criticalPaths) {
      const filePath = resolve(dist, p.replace(/^\//, ''));
      if (!existsSync(filePath)) {
        failures.push(`dist/index.html references ${p} but dist/ does not contain it`);
        continue;
      }
      const gzipKb = gzipSync(readFileSync(filePath)).byteLength / 1000;
      totalGzipKb += gzipKb;
      console.log(`  - ${p}: ${(Math.round(gzipKb * 100) / 100).toFixed(2)} kB gzipped`);
    }
    const roundedTotal = Math.round(totalGzipKb * 100) / 100;
    console.log(
      `Total critical-path JS: ${roundedTotal.toFixed(2)} kB gzipped (budget ${MAX_CRITICAL_PATH_GZIP_KB} kB)`,
    );
    if (totalGzipKb > MAX_CRITICAL_PATH_GZIP_KB) {
      failures.push(
        `critical-path JS is ${roundedTotal.toFixed(2)} kB gzipped, over the ${MAX_CRITICAL_PATH_GZIP_KB} kB budget`,
      );
    }
  }
}

// 2. Manifest and icons present in the built output.
const manifestPath = resolve(dist, 'manifest.webmanifest');
if (!existsSync(manifestPath)) {
  failures.push('dist/manifest.webmanifest is missing — did public/ get copied?');
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const icon of manifest.icons as { src: string }[]) {
    if (!existsSync(resolve(dist, icon.src.replace(/^\//, '')))) {
      failures.push(`manifest declares ${icon.src} but dist/ does not contain it`);
    }
  }
}

// 3. Icons linked directly from dist/index.html — apple-touch-icon.png and
//    favicon-32.png are neither in manifest.icons nor covered by section 2,
//    so nothing else in this script checks them. The iOS install path
//    depends on apple-touch-icon.png: if it 404s, iOS silently substitutes
//    a screenshot of the page for the Home Screen icon.
if (existsSync(indexHtmlPath)) {
  const html = readFileSync(indexHtmlPath, 'utf8');
  for (const m of html.matchAll(/<link\b[^>]*\brel=["'][^"']*icon[^"']*["'][^>]*>/gi)) {
    const href = m[0].match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    if (!existsSync(resolve(dist, href.replace(/^\//, '')))) {
      failures.push(`index.html links ${href} but dist/ does not contain it`);
    }
  }
}

// 4. Typography scale compiled output. src/tokens.css declares seven
//    --text-* steps and applies tabular numerals to .text-money via an
//    @utility block (not a --text-money--font-variant-numeric theme-key
//    suffix — Tailwind doesn't wire that suffix up to anything). Both
//    claims are checked here against the real emitted CSS, not the source.
const cssAssetsDir = resolve(dist, 'assets');
if (!existsSync(cssAssetsDir)) {
  failures.push('dist/assets/ is missing — cannot check compiled CSS for the typography scale');
} else {
  const cssFiles = readdirSync(cssAssetsDir).filter((f) => f.endsWith('.css'));
  if (cssFiles.length === 0) {
    failures.push('no .css file found in dist/assets/ — cannot check the typography scale');
  } else {
    const css = cssFiles.map((f) => readFileSync(resolve(cssAssetsDir, f), 'utf8')).join('\n');

    const TEXT_STEPS = ['display', 'title', 'heading', 'body', 'label', 'caption', 'money'];
    for (const step of TEXT_STEPS) {
      // A real definition (e.g. `--text-money:.9375rem`), not merely a
      // utility referencing it via var(--text-money) — that would pass even
      // if the defining declaration were missing entirely.
      if (!new RegExp(`--text-${step}:\\s*[0-9.]+rem`).test(css)) {
        failures.push(
          `compiled CSS never defines --text-${step} with a real value (checked dist/assets/*.css)`,
        );
      }
    }

    if (!/\.text-money\s*\{[^}]*font-variant-numeric:\s*tabular-nums[^}]*\}/.test(css)) {
      failures.push(
        'compiled CSS has no .text-money rule applying font-variant-numeric:tabular-nums — ' +
          'the @utility block in src/tokens.css is missing or not reaching the build ' +
          '(checked dist/assets/*.css)',
      );
    }
  }
}

if (failures.length > 0) {
  console.error('\nBundle check failed:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log('Bundle check passed.');
