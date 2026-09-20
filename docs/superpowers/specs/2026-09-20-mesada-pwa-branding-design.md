# v2.1 — Mesada: installable app, brand identity, and bundle optimization

**Date:** 2026-09-20
**Status:** Approved for planning
**Ships as:** v2.1 (QA → PRD, own smoke cycle)
**Follows into:** [v2.2 design language](./2026-09-20-mesada-design-language-design.md)

## Why

Two unrelated complaints, one release.

The app cannot be installed. Chrome shows its omnibox install button — the one NotebookLM and YouTube get — only for sites that ship a web app manifest with proper icons. This repo has no `public/` directory, no manifest, and an `index.html` carrying nothing but a `<title>`. Nothing is broken; the piece was never built.

The app also has no identity. It is called "Budget Manager" in the title, "Budget" in three copy-pasted header blocks, and its logo is the `💵` emoji. An app the user launches from the macOS Dock needs a name and a mark.

Separately, the production bundle is a single 493 kB chunk with no code splitting, which matters more once the app is launched from the Dock and judged against native apps.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Name | **Mesada** | Spanish for "monthly allowance". Names the app's actual core loop — the month switcher and the rollover. Two syllables, works as a Dock label. |
| PWA depth | **Manifest only. No service worker.** | Verified against Chrome's installability criteria: HTTPS + manifest + `start_url` + `display: standalone` + 192px and 512px icons. A service worker is *not* required. All data lives in Supabase behind AAL2, so an offline cache buys almost nothing, while a service worker on a Vercel SPA is a well-known source of stale-build bugs. |
| Icon | **Stacked coins, redrawn flat** | Chosen from six generated directions. The generated version uses 3D perspective that will not survive a 32px favicon, so it is redrawn straight-on. |
| Rename reach | **In-app only** | Vercel URLs, the GitHub repo, and the Supabase projects keep their current names. This deliberately avoids touching `VITE_APP_URL`, which would otherwise desynchronise the user's existing TOTP factor. |

### Explicit non-goals

- No service worker, no offline mode, no background sync.
- No change to `VITE_APP_URL`, Vercel project names, Supabase project refs, or the GitHub repo name.
- No schema change, no RLS change, no migration. This release is entirely client-side.
- No UI restyle. The look is v2.2's job; v2.1 deliberately ships a polished icon onto the current UI.

## Architecture

### 1. The mark

`public/icon.svg` is the single source of truth: a flat, straight-on stack of three discs — sage on top, two browns beneath — drawn as plain ellipses and rounded rects with no perspective, no bevel, and no symbols on any coin face. Blank faces are a requirement, not a style choice: the app handles USD, EUR and VES, so a `$` on the icon would contradict the product.

**Constraint the implementation must satisfy:** the mark must remain unambiguous at 32×32. Geometry may be adjusted freely to achieve that; the disc count and the sage-on-brown colour relationship may not.

**Checkpoint:** the flattened SVG is rendered at 512, 192 and 32 px and shown to the user for approval *before* it is referenced by the manifest. This is a hard gate — a rejected mark at that point costs one file, whereas a rejected mark after wiring costs the whole asset set.

`src/components/MesadaMark.tsx` draws the same geometry as inline React SVG using theme tokens rather than hardcoded hex, so the in-app logo tracks Peach/Sage/Lavender × light/dark. The two files intentionally duplicate the geometry: `icon.svg` must be a static file servable to the browser before React boots, and cannot read CSS custom properties.

### 2. Icon raster pipeline

Chrome requires raster PNGs. Rather than add an image-processing dependency, `scripts/generate-icons.ts` renders `icon.svg` through the **Playwright already present as a devDependency** and writes:

| File | Size | Purpose |
|---|---|---|
| `icon-192.png` | 192×192 | Chrome installability minimum |
| `icon-512.png` | 512×512 | Chrome installability minimum |
| `icon-maskable-512.png` | 512×512 | `purpose: "maskable"`, with safe-zone padding so macOS/Android masking cannot clip the stack |
| `apple-touch-icon.png` | 180×180 | iOS home screen |
| `favicon-32.png` | 32×32 | Fallback for browsers that ignore SVG favicons |

Exposed as `npm run icons`. Run manually, outputs committed to git. This keeps the build dependency-free and keeps the assets reviewable in a diff.

### 3. Manifest

`public/manifest.webmanifest`:

- `id: "/"` — pinned explicitly so the app's identity cannot drift if `start_url` ever changes.
- `name` and `short_name`: `"Mesada"`.
- `start_url: "/"`, `scope: "/"`, `display: "standalone"`.
- `background_color: "#fef3ec"` (Peach light `--bg`) — the splash colour before React paints.
- `icons`: all five entries above, with correct `sizes`, `type`, and `purpose`.

`public/` does not exist in this repo today. Vite copies it to `dist/` automatically, so `vercel.json` needs no change.

### 4. `index.html`

Title → `Mesada`. Adds the manifest link, the SVG favicon with PNG fallback, `apple-touch-icon`, a `description` meta, the iOS web-app metas, and a `theme-color` meta whose value is updated at runtime (below).

### 5. Theme-color sync

In a standalone PWA window, Chrome tints the title bar from `theme-color`. A static peach value would look visibly wrong the moment the user switches to Lavender dark. `ThemeProvider` therefore gains an effect that reads the resolved `--bg` and writes it into the meta tag on every theme or mode change.

This is correctness for the feature being shipped, not decoration: without it, installing the app makes the theme switcher look broken.

### 6. One wordmark, three call sites

`💵` + `"Budget"` is currently duplicated across `Header.tsx:37-38`, `Login.tsx:25-26`, and `Signup.tsx:28-29`. These collapse into a single `Wordmark` component composing `MesadaMark` + the name. Nothing in `src/` or `e2e/` asserts on the string `"Budget"`, so the rename is clean.

### 7. Bundle optimization

Baseline measured 2026-09-20 on `staging`:

```
dist/assets/index-*.css    27.07 kB │ gzip:   5.94 kB
dist/assets/index-*.js    493.32 kB │ gzip: 137.59 kB   ← single chunk, no splitting
```

Three changes, cheapest first:

1. **Route-level code splitting.** `Insights`, `Accounts`, and `Settings` become `React.lazy` imports behind a `Suspense` boundary. They are separate pages the user reaches by an explicit click, and they drag in `ProjectedVsActualChart`, `ExchangeRatesPanel`, `CategoriesEditor`, and `EmojiPicker` — none of which the dashboard needs.
2. **Defer `drag-drop-touch`.** `main.tsx:1` imports this touch-drag polyfill eagerly for every user, including desktop, where it is inert. It becomes a dynamic import gated on coarse-pointer detection.
3. **Lazy `AttachmentViewer`.** The receipt viewer is a modal that most sessions never open.

**Budget, enforced by test.** The rule is a ratchet, defined in two parts so it cannot be read two ways:

1. **Target:** get the initial JS chunk to **≤ 115 kB gzipped**, down from the 137.59 kB baseline. Roughly 90–100 kB of the current bundle is React plus `supabase-js`, both needed before first paint, so this is close to the practical floor without deferring authentication itself — which is out of scope.
2. **Assertion:** once the work lands, `npm run check:bundle` is pinned to the figure actually measured, rounded **up** to the next 5 kB. If the result is 108.2 kB, it asserts ≤ 110 kB. The same script also asserts that `dist/` actually contains the manifest and every icon it declares — which is the only check in the suite that inspects Vercel's real build output.

So the target drives the effort, and the assertion locks in the result. A future change may only raise the pinned number by editing it deliberately, with the reason in the commit message. This is the mechanism that stops v2.2's restructure from silently undoing the split.

## Testing

**Test-first is mandatory on every item below.** Write the test, run it, confirm it fails for the intended reason, then implement. This applies equally to tests that must change: rewrite the test to express the new behaviour and watch it go red *before* touching the implementation. A test that has never been observed failing is not evidence of anything.

### Vitest

| Area | Assertions |
|---|---|
| `MesadaMark` | Renders; uses theme tokens rather than hardcoded hex; has an accessible name. |
| `Wordmark` | Renders the mark and the name "Mesada"; used by Header, Login and Signup. |
| Theme-color sync | Meta tag updates on theme change and on mode change; matches the resolved `--bg`. |
| **Manifest contract** | Parses as JSON; has `name`, `short_name`, `start_url`, `display: "standalone"`, `id`; declares both a 192px and a 512px icon; declares a maskable icon. Every declared icon file exists on disk. |
| Theme colour map | The TS background map matches the `--bg` value declared in `src/themes.css` for all six theme × mode combinations. |
| Lazy routes | Insights/Accounts/Settings still render after their chunk resolves; the Suspense fallback does not flash on an already-loaded route. |

**Why the theme colour map is a TS constant rather than a computed style read.** jsdom does not load `src/index.css`, so `getComputedStyle(documentElement).getPropertyValue('--bg')` returns an empty string under test — an effect written that way would be untestable at the unit level. The map therefore lives in TypeScript, and a test parses `src/themes.css` and asserts the two agree. The CSS stays the single source of truth; the test enforces it.

### Bundle budget — a post-build script, not a Vitest test

The budget check **cannot** be a Vitest test. `npm test` runs before `npm run build` in both CI and `vercel.json`, so `dist/` does not exist at that point; a test reading it would either fail spuriously or silently skip.

It is instead `scripts/check-bundle-size.ts`, exposed as `npm run check:bundle`, run **after** the build in two places:

- `.github/workflows/ci.yml` — a new step after `Build`.
- `vercel.json` — `buildCommand` becomes `npm test && npm run build && npm run check:bundle`, so a regression blocks the deploy rather than merely annoying CI.

The manifest contract test is the important one. Installability is invisible in normal use — it fails silently and the only symptom is a missing button that nobody thinks to look for. This test makes that failure loud.

### Playwright

New `e2e/specs/pwa-install.e2e.ts`.

**What this actually runs against.** `playwright.config.ts` resolves `baseURL` to `E2E_BASE_URL ?? 'http://localhost:5173'`, and the CI `e2e` job does not set `E2E_BASE_URL` — so the suite drives a **local `npm run dev` server against the real QA Supabase backend**, not the deployed QA site. Vite's dev server does serve `public/` at the root, so these assertions are meaningful there. But they verify the *source* assets, not Vercel's build output, and that limit must not be glossed over:

- The **E2E spec** proves the manifest and icons are correct and self-consistent.
- The **`npm run check:bundle` step** proves the production build actually emitted them, since it runs against `dist/` and fails the Vercel build otherwise.
- The **QA smoke** is what finally proves it on the deployed URL, by installing the app from QA in a real browser.

Assertions:

- `/manifest.webmanifest` returns 200 with a JSON content type and parses.
- Every icon URL it declares returns 200 with an image content type and the declared pixel dimensions.
- The document title is `Mesada` and the `theme-color` meta is present.
- The wordmark renders on the dashboard.

Per the standing convention, every feature gets an E2E spec, not just backend flows.

## Risks

| Risk | Mitigation |
|---|---|
| macOS caches Dock icons aggressively. A later revision to the mark may not appear without reinstalling. | Called out in the QA smoke checklist. This is also why the icon has an approval checkpoint before wiring. |
| `public/` is new to this repo; if Vite or Vercel did not copy it, the manifest would 404 in production while passing locally. | The E2E spec fetches the manifest from the deployed QA URL, so a copy failure fails CI rather than reaching PRD. |
| Code splitting could regress a page behind a Suspense boundary in a way unit tests miss. | Existing E2E specs already navigate to Insights, Accounts and Settings; they will exercise the lazy paths against a real build. |
| The bundle-budget test could become an obstacle during v2.2. | Intentional. It should be consciously re-baselined with a justification, not silently deleted. |

## Rollout

Standard project flow, no deviations:

1. Implement on `staging`, subagent-driven, one task per subagent.
2. Push to `staging`; QA deploy goes green.
3. User smokes the QA URL — including installing the app on macOS from QA and confirming the Dock icon, window title, and theme-color behaviour.
4. User explicitly authorizes the push to `main`.
5. Fast-forward merge; PRD deploys.
6. User smokes PRD, including a fresh install.
7. Notion `v2.1 Smoke Tests` sub-page created under the hub and linked from the Versions index.

No migration, no Supabase change, and nothing that touches the existing TOTP enrollment.
