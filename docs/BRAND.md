# Mesada brand manual

This document records the decisions behind Mesada's visual language and,
more importantly, *why* each one was made. The values themselves live in
`src/tokens.css` and `src/themes.css`, and are enforced by
`src/theme/tokens.test.ts` and the compiled-output checks in
`scripts/check-bundle-size.ts` — read those files for the current numbers.
This manual exists because a value on its own doesn't tell a future
contributor why it's safe to change or why it isn't. Chunks 2 and 3 of the
v2.2 design-system overhaul restyle the app against the tokens recorded
here; this document is what those chunks (and anyone after them) conform
to.

Every contrast figure below was recomputed directly from the committed
`src/themes.css`, using the app's own `contrastRatio`/`relativeLuminance`
helpers (`src/utils/contrast.ts`) — not copied from a plan, a PR
description, or this file's own history. See "How the numbers in this
document were produced" at the end.

## 1. The mark

`MesadaMark` (`src/components/MesadaMark.tsx`, with a hand-maintained
static twin at `public/icon.svg` for the favicon/PWA icon, which loads
before React and so can't read CSS custom properties) draws three stacked
coins, flat and straight-on: each coin is a lighter elliptical top face
over a darker rectangular/elliptical body. That two-tone split is what
reads as "coin" instead of "slab" — it's flat shading, not 3D or
perspective, because perspective turns to mush at favicon size (the icon
ships at 32×32 and as an SVG favicon that can render smaller still).

**Coin faces are deliberately blank.** Mesada handles three currencies —
USD, EUR, VES (`src/utils/currency.ts`) — so putting a `$` or any other
currency glyph on the coin face would assert a single currency the product
doesn't have. Leaving the face blank is the only reading that doesn't
contradict multi-currency support.

**The face must always be visibly lighter than the edge**, not just
technically lighter. `src/theme/tokens.test.ts`'s "shaded token pairs stay
visibly separated" suite asserts this as a **luminance gap of ≤85%**
(shade ÷ face), not a plain "is the shade darker" ordering check. This
distinction is load-bearing: earlier in this chunk, darkening `--positive`
to clear WCAG AA left `peach/light`'s existing `--positive-shade` at 97%
of the face's luminance — strictly darker, so an ordering assertion would
have passed, while the coin visually rendered as a flat blob with no
edge/face distinction at all. The gap is what the eye actually needs; the
ordering check couldn't tell the difference between "subtly two-tone" and
"one flat color."

- **Clear space:** one coin-width on all sides.
- **Minimum size:** 16px. Below that the ellipse-over-rectangle geometry
  stops reading as two shapes.
- Uses `var(--positive)`/`var(--positive-shade)` for the top coin and
  `var(--neutral)`/`var(--neutral-shade)` for the other two — CSS custom
  properties, not a `useTheme()` hook, because `ThemeProvider` sits inside
  `AuthGate` while Login and Signup render outside it and still need the
  mark.

## 2. The wordmark

`Wordmark` (`src/components/Wordmark.tsx`) composes `MesadaMark` with the
name "Mesada" and is the single source for what used to be three
copy-pasted logo blocks across Header, Login, and Signup.

- `as="h1"` on auth screens (Login, Signup) — they're standalone pages, so
  the wordmark should also be the page's heading landmark for screen
  reader users. Default `as="span"` in the in-app header, which has its
  own separate heading structure and shouldn't get a second `h1`.
- The mark itself is `aria-hidden` unconditionally inside `Wordmark`. The
  adjacent visible text "Mesada" already names the app; giving the SVG an
  accessible name too would announce "Mesada Mesada" to assistive tech.
- `size="sm"` (24px mark, `text-xl` name) for the header; `size="lg"` (40px
  mark, `text-2xl` name) for auth screens. `size` and `as` are independent
  props on purpose — a large wordmark isn't always a page heading, and
  tying them together would be an implicit, surprising coupling for
  whoever reaches for this component next.

## 3. Colour

Six theme × mode combinations exist: **peach**, **sage**, **lavender**, each
in **light** and **dark**. Every text-bearing token — `--text`, `--muted`,
`--positive`, `--negative`, `--warning` — clears **WCAG AA (≥4.5:1)**
against *both* `--bg` and `--card`, in all six combinations, enforced by
`src/theme/tokens.test.ts`'s "colour tokens meet WCAG AA" suite. That
suite is what should catch a regression here, not eyeballing a swatch.

### Contrast ratios (recomputed from `src/themes.css`, 2 decimal places)

| Theme / mode | `--text` on bg / card | `--muted` on bg / card | `--positive` on bg / card | `--negative` on bg / card | `--warning` on bg / card |
|---|---|---|---|---|---|
| peach / light    | 12.04 / 13.14 | 4.64 / 5.07 | 4.57 / 4.99 | 4.93 / 5.38 | 4.56 / 4.98 |
| peach / dark     | 13.07 / 10.91 | 7.16 / 5.98 | 8.59 / 7.17 | 5.42 / 4.52 | 7.59 / 6.34 |
| sage / light     | 10.58 / 11.54 | 4.62 / 5.04 | 4.63 / 5.04 | 4.51 / 4.92 | 4.61 / 5.03 |
| sage / dark      | 12.64 / 10.19 | 7.82 / 6.31 | 7.84 / 6.33 | 5.61 / 4.53 | 7.55 / 6.09 |
| lavender / light | 11.30 / 12.67 | 4.60 / 5.16 | 4.50 / 5.05 | 4.57 / 5.12 | 4.56 / 5.11 |
| lavender / dark  | 12.79 / 10.58 | 7.33 / 6.06 | 8.39 / 6.94 | 5.54 / 4.58 | 7.21 / 5.96 |

Every cell is ≥4.5. Several sit close to the floor on purpose rather than
by accident — `lavender/light --positive` on `--bg` is 4.50, `sage/light
--negative` on `--bg` is 4.51, `peach/dark --negative` on `--card` is
4.52. These were tuned to *just* clear AA rather than pulled further
toward black/white, because pushing them further would have started to
mute the theme's identity (the whole point of having peach/sage/lavender
as distinct palettes) for no accessibility benefit past the 4.5 floor.
`--muted` and `--text` run well above the floor because they're read far
more densely (`--muted` is 12px caption/label text throughout the app) and
had more headroom to spend without threatening the palette.

### `--positive`/`--positive-shade` and `--neutral`/`--neutral-shade`

These four tokens are not text-contrast tokens — they're a **face/shade
pair** for two-tone shapes, currently only `MesadaMark`'s coins. `positive`
and `neutral` are the lighter face; `positive-shade` and `neutral-shade`
are the darker edge. The pairing exists so the mark's colours stay
theme-aware (`var(--positive)`, never a hardcoded hex — see §1) while
still guaranteeing the two-tone read holds in every theme and mode.

As covered in §1, the test for this pairing (`src/theme/tokens.test.ts`,
"shaded token pairs stay visibly separated") asserts the **luminance gap**
(`shade / face` luminance ≤ 0.85), not merely that the shade is darker.
Recomputed from `src/themes.css`:

| Theme / mode | `positive-shade`/`positive` | `neutral-shade`/`neutral` |
|---|---|---|
| peach / light    | 73.8% | 19.0% |
| peach / dark     | 48.2% | 52.0% |
| sage / light     | 74.0% | 25.9% |
| sage / dark      | 48.5% | 59.6% |
| lavender / light | 78.5% | 21.4% |
| lavender / dark  | 48.4% | 54.7% |

All comfortably under the 85% ceiling — but `peach/light`'s
`positive-shade` at 73.8% is the closest of the three light themes to that
ceiling, which is exactly the pairing the WCAG AA fix (§ above) pushed to
97% before the gap assertion caught it and it was pulled back to
`#506745`. Keep that history in mind before nudging `--positive` in any
light theme for a future contrast tweak: check the shade gap, not just the
`--positive` text-contrast number, or the coin can quietly go flat again.

## 4. Typography

Seven steps, defined in `src/tokens.css`, each carrying a size, a
line-height, and a font-weight together as one role — a caller picks
`text-display`, never a raw `text-[2.5rem]`, so line-height and weight
aren't independently re-decided at every call site (which is what made the
pre-token UI feel unsystematic).

| Step | Size | Line-height | Weight | Role |
|---|---|---|---|---|
| `text-display` | 2.5rem | 1.1 | 800 | Balance figures — the largest thing on the dashboard. |
| `text-title` | 1.5rem | 1.25 | 700 | Page and major section headings. |
| `text-heading` | 1.125rem | 1.3 | 700 | Card headings — category names, panel titles. |
| `text-body` | 0.9375rem | 1.5 | 400 | Default running text. |
| `text-label` | 0.8125rem | 1.4 | 600 | Form labels, column headers. |
| `text-caption` | 0.75rem | 1.4 | 400 | Helper text, counts, timestamps. |
| `text-money` | 0.9375rem | 1.5 | 600 | Money — same size as body, tabular figures. |

`text-label` at weight 600 fills a gap the app previously had none of
(only 400/700/800 existed), so labels and column headers used to be set in
bold and visually competed with real headings.

**`text-money` exists so amounts line up in a column.** Tabular figures
(`font-variant-numeric: tabular-nums`) are what makes that happen — without
them, digit widths vary and a column of dollar amounts drifts out of
alignment as the digits change.

**`tabular-nums` is applied by an `@utility text-money { ... }` block in
`src/tokens.css`, not by a `--text-money--*` theme-key suffix.** The
original attempt used `--text-money--font-variant-numeric` as a fourth
suffix alongside `--line-height`/`--font-weight`, on the assumption that
any suffix on a `--text-*` key gets wired into the generated utility.
Tailwind 4 only recognises three companion suffixes on a `--text-*` theme
key — `--line-height`, `--letter-spacing`, `--font-weight` — so that
fourth suffix compiled to a dangling custom property under `:root` that no
utility ever read. Nothing failed loudly: the property existed, source-text
tests that grepped for the string passed, and `.text-money` silently
never got tabular numerals in the compiled CSS. It was only caught by
adding a compiled-output check (`scripts/check-bundle-size.ts`) that greps
`dist/assets/*.css` for an actual `.text-money { font-variant-numeric:
tabular-nums }` rule rather than trusting the source. **Do not re-add a
fourth `--text-*` suffix expecting Tailwind to wire it up — it won't; use
a real `@utility` block instead, the way `text-money` does.**

**Do not stack a `font-*` or `leading-*` utility on a `text-*` step.**
Tailwind compiles a generated `text-*` utility's line-height/weight as
`line-height: var(--tw-leading, var(--text-*--line-height))` and
`font-weight: var(--tw-font-weight, var(--text-*--font-weight))`.
Tailwind's own `leading-*` and `font-*` weight utilities set
`--tw-leading`/`--tw-font-weight`, which silently wins over the token's
own value — no build error, and often no visible difference if the
override happens to match. A component that writes `text-heading
font-bold` is not guaranteed to render at the `text-heading` weight; it's
gambling on whether `font-bold` happens to agree with `--text-heading`'s
own 700. Pick a different step instead of stacking a weight/line-height
utility on top of one.

## 5. Geometry

Three radius tokens, defined in `src/tokens.css`:

| Token | Value | Used by |
|---|---|---|
| `--radius-control` | 0.5rem | Buttons, inputs, date cells. |
| `--radius-card` | 0.75rem | Cards and panels. |
| `--radius-chip` | 9999px | Pills and chips. |

These values were chosen to match what the app already renders today,
not to change it: as of this chunk, no component has been migrated to the
`rounded-control`/`rounded-card`/`rounded-chip` utility classes yet (that
migration is chunk 2/3's job) — components still write Tailwind's default
`rounded-lg` (0.5rem, cards/buttons/inputs), `rounded-xl` (0.75rem, section
cards), and `rounded-full` (pills, budget-bar fills) directly. The token
values are deliberately identical to those defaults so that swapping a
literal `rounded-lg`/`rounded-xl`/`rounded-full` for its semantic
`rounded-control`/`rounded-card`/`rounded-chip` equivalent in chunk 2/3 is
a rename, not a redesign — nothing should visibly move when that migration
lands.

**Spacing deliberately introduces no tokens.** Tailwind's default spacing
scale is already one consistent ramp; a second, parallel spacing scale
would be machinery competing with it for no benefit — every value in it
would just be a rename of a Tailwind step. The discipline instead is to
stay on a **sanctioned subset of Tailwind's own scale: 1, 2, 3, 4, 6, 8,
12** (i.e. `p-2`, `gap-4`, `mb-8`, and so on — not `p-5`, `gap-7`, or an
arbitrary `p-[13px]`). This was a choice, not an oversight: it keeps
spacing consistent without inventing anything for a future reader to learn
on top of Tailwind's own vocabulary.

## 6. Elevation

Three shadow levels, `--elev-1`/`--elev-2`/`--elev-3`, defined per theme
per mode in `src/themes.css` and exposed to Tailwind as `shadow-e1`/
`shadow-e2`/`shadow-e3` utilities via `--shadow-e1: var(--elev-1)` etc. in
`src/index.css`'s `@theme` block.

- **Light themes** use the theme's own `--text` colour as the shadow tint
  (e.g. peach light shadows are `rgba(61, 44, 46, ...)`, peach's `--text`
  RGB), at alpha 0.06 / 0.08 / 0.12 for levels 1/2/3 — a tinted shadow
  reads as depth without looking like a generic grey drop-shadow bolted
  onto a warm palette.
- **Dark themes** use plain black at a much stronger alpha (0.30 / 0.40 /
  0.50). A soft light-mode-strength shadow is invisible on a dark surface,
  so dark-mode shadows have to be deeper just to register at all.
- **Dark themes get most of their perceived depth from surface lightness,
  not from heavier shadows** — `--card` is lighter than `--bg` in every
  dark block (e.g. peach dark: `--bg #2a1f1c`, `--card #3a2c28`), and that
  lightness step is what actually separates a card from the page behind
  it. The strengthened shadow alpha is a secondary cue on top of that, not
  the primary one — a dark UI that relied on shadow alone to read as
  layered would need implausibly heavy shadows to compete with a
  low-contrast dark background.

## 7. Voice

Short, plain, second person ("you," not "the user"). No jargon in
user-facing copy. Money is always formatted through `formatCurrency`
(`src/utils/currency.ts`) — `formatMoney` in `src/utils/money.ts` is a
USD-only shorthand over the same function — never hand-built with a
template literal; this keeps VES's non-Intl "Bs. 1,234.50" formatting and
USD/EUR's `Intl.NumberFormat` currency style from ever drifting apart.

**No version numbers in changelog highlight text.** `src/changelog.ts`
carries the version number in its own `version` field per entry; the
`highlights` strings themselves describe what changed in plain language
("The app has a name and a face: Mesada, with a new coin-stack icon.")
and never say "v2.1" or similar inline — a user reading the changelog
should never need to know or care what number a release carries to
understand what changed.

## Known and open

Recorded honestly rather than papered over — both are pre-existing,
neither is addressed by this chunk:

- **First-paint theme flash.** `index.html` hardcodes `data-theme="peach"
  data-mode="light"` on the root `<html>` element (it has to render
  *something* before any JavaScript runs). `ThemeProvider` only overwrites
  those attributes with the user's stored preference once it mounts, so a
  user on any other theme or dark mode sees a brief flash of peach/light
  before their actual theme applies. Not fixed here.
- **Dashboard accessibility debt.** The projected/actual budget inputs
  have no accessible labels, and some dashboard text fails contrast — both
  surfaced when the receipts a11y scan (added in v1.9) ran unscoped and
  hit the dashboard behind the modal it was meant to test, rather than
  from any dedicated dashboard a11y check (none exists yet). This is
  chunk 3's job, not this chunk's — chunk 1 only lands tokens, it doesn't
  restyle any component.

## How the numbers in this document were produced

Every ratio in §3 was computed from the token hex values as committed in
`src/themes.css` (read directly, not transcribed from a plan or this
document's own draft), using the project's own contrast helpers in
`src/utils/contrast.ts` (`contrastRatio` for the WCAG table,
`relativeLuminance` for the shaded-pair percentages) — the same functions
`src/theme/tokens.test.ts` uses to enforce these invariants, so the
numbers here are computed the same way the test suite checks them, not by
a separate, potentially-diverging method.

`node -e` cannot run this directly: it evaluates as CommonJS, and a
top-level ESM `import` is a syntax error there. Instead, a throwaway
script (outside the repo, deleted after use) imported `contrastRatio` and
`relativeLuminance` from the absolute path to `src/utils/contrast.ts` and
was run with `node --experimental-strip-types <script>.ts`, which
transpiles and executes the `.ts` file's ESM `import` directly. Sample
output (peach/light):

```
--text      on bg=12.04  on card=13.14
--muted     on bg=4.64  on card=5.07
--positive  on bg=4.57  on card=4.99
--negative  on bg=4.93  on card=5.38
--warning   on bg=4.56  on card=4.98
positive-shade/positive luminance ratio: 73.8%
neutral-shade/neutral luminance ratio: 19.0%
```

matching the peach/light row of the tables in §3 above. The full script
and its output for all six theme/mode combinations are recorded in
`.superpowers/sdd/2026-09-20-v2.2-chunk1-tokens-and-brand-manual/task-5-report.md`.
