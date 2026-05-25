# Budget Manager v1.1 — Frontend Redesign Spec

**Date:** 2026-05-25
**Status:** Approved — ready for implementation planning
**Builds on:** `docs/superpowers/specs/2026-05-25-budget-manager-design.md` (v1)

---

## 1. Overview

A visual + UX refresh of the Budget Manager dashboard. Three things change:

1. The look and feel adopts a warm, distinctive "Peach & Terracotta" palette as the default theme, with full light and dark variants.
2. The user can choose between three preset themes (Peach, Sage, Lavender) on a new Settings page. The choice persists to the user's Supabase profile so it follows them across devices.
3. Targeted UX improvements ship alongside the visual work: a "balance at a glance" hero card, friendlier empty-category states, a fixed +Add item flow that lets users enter projected/actual values before commit, mobile-responsive reflow, and a Settings page reachable from the header.

Nothing about the data model for `income`, `categories`, or `line_items` changes. Auth flow is untouched. RLS + AAL2 still apply.

## 2. Goals

- Replace generic Tailwind-default styling with a curated, opinionated visual language ("Peach & Terracotta" by default).
- Ship full light AND dark color variants for all three preset themes.
- Add a Settings page with a theme picker that persists the choice across devices.
- Fix the known +Add item UX flaw so users can type projected and actual values before the row commits.
- Add a "Where you stand" balance hero card that surfaces projected vs. actual balance with a one-line narrative.
- Render an empty-state card for categories with no items (instead of an empty table).
- Make the dashboard usable on phones (≤640px viewport).
- Maintain WCAG AA contrast on every theme/mode combination.

## 3. Non-goals (v1.1)

- Custom hex/color picker — preset themes only.
- Custom fonts, border-radius, or density controls.
- New data fields on `income`/`categories`/`line_items`.
- Layout restructuring (sidebar nav, accordion categories, etc.) — the existing top-to-bottom flow stays.
- Charts, sparklines, or analytics.
- Changes to the auth flow or MFA enrollment screens (beyond visual restyle).
- Animated transitions beyond CSS `transition` on hover/focus.
- Custom user-editable categories or month rollover (still in the v1 deferred list).

## 4. Tech stack additions

| Concern | Choice |
|---|---|
| Theme system | CSS custom properties (CSS variables) keyed off `data-theme` and `data-mode` attributes on `<html>` |
| Tailwind integration | Tailwind config exposes the CSS variables as semantic tokens (`bg-bg`, `bg-card`, `text-text`, `text-positive`, etc.) |
| Theme provider | New `ThemeProvider` React component that reads/writes the user's preferences and applies the data attributes |
| Persistence | New `public.user_preferences` table in Supabase, scoped per-user with RLS + AAL2 |
| Fonts | Nunito for sans-serif (loaded via Google Fonts), system stack fallback. Tabular numerals enabled on money inputs via `font-feature-settings: 'tnum'` |
| Icons | Native emoji (no library) for category icons. Reduces bundle and avoids licensing |

No new build steps, no new bundler config. Tailwind already in place.

## 5. Schema change

### New table: `user_preferences`

```sql
create table public.user_preferences (
  user_id    uuid primary key references auth.users on delete cascade,
  theme      text not null default 'peach'
             check (theme in ('peach', 'sage', 'lavender')),
  color_mode text not null default 'light'
             check (color_mode in ('light', 'dark')),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "own preferences, mfa required" on public.user_preferences
  for all
  using (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    auth.uid() = user_id
    and (auth.jwt() ->> 'aal') = 'aal2'
  );
```

### Trigger update

The existing `seed_user_budget()` trigger function is extended to also insert a `user_preferences` row with the default `'peach'` / `'light'`. The trigger remains `security definer` with `set search_path = public`.

### Migration files

- `supabase/migrations/0005_user_preferences.sql` — creates the table, RLS policies, **and backfills a default preferences row for every existing `auth.users`** (so v1 users get a row immediately, not on next signup).
- `supabase/migrations/0006_extend_seed_trigger.sql` — `create or replace` the function so new signups get a preferences row. The insert uses `on conflict (user_id) do nothing` to be safe against race conditions with the 0005 backfill.

```sql
-- in 0005 after the policies:
insert into public.user_preferences (user_id)
  select id from auth.users
  on conflict (user_id) do nothing;
```

## 6. Theme architecture

### CSS variables (one source of truth)

All theme colors live in `src/themes.css`. Each combination of theme × mode defines the same set of variables:

```css
:root[data-theme="peach"][data-mode="light"] {
  --bg:        #fef3ec;
  --card:      #ffffff;
  --highlight: #f5d5c0;
  --text:      #3d2c2e;
  --muted:     #a88373;
  --positive:  #86a578;
  --negative:  #b54545;
  --dashed:    #e7c4ac;
  --hero-bg:   #3d2c2e;
  --hero-text: #fef3ec;
}

:root[data-theme="peach"][data-mode="dark"] {
  --bg:        #2a1f1c;
  --card:      #3a2c28;
  --highlight: #5a3d35;
  --text:      #f5e6d3;
  --muted:     #c4a896;
  --positive:  #a3c897;
  --negative:  #d97777;
  --dashed:    #6a5044;
  --hero-bg:   #f5e6d3;
  --hero-text: #2a1f1c;
}

/* same shape for sage and lavender, in both modes */
```

All exact color hex values for each theme/mode combination are listed in `Appendix A` at the bottom of this document.

### Tailwind exposure

`tailwind.config.js` declares semantic color names that point at the CSS variables:

```js
colors: {
  bg:        'var(--bg)',
  card:      'var(--card)',
  highlight: 'var(--highlight)',
  text:      'var(--text)',
  muted:     'var(--muted)',
  positive:  'var(--positive)',
  negative:  'var(--negative)',
  dashed:    'var(--dashed)',
  'hero-bg':   'var(--hero-bg)',
  'hero-text': 'var(--hero-text)',
}
```

Components use these names (`bg-card`, `text-muted`, etc.). Switching themes is a single attribute change on `<html>`; no React re-render or component-level color logic.

### ThemeProvider

```ts
// src/theme/ThemeProvider.tsx — pseudosignature
type Theme = 'peach' | 'sage' | 'lavender';
type Mode  = 'light' | 'dark';

<ThemeProvider>{children}</ThemeProvider>
```

Responsibilities:
1. On mount (inside `AuthGate` after AAL2), fetch the user's preferences from `user_preferences` table via a new `getPreferences()` API call.
2. Set `<html data-theme={theme} data-mode={mode}>`.
3. Expose `theme`, `mode`, `setTheme(theme)`, `setMode(mode)` via React context.
4. On change, optimistically update the data attributes and call `updatePreferences()` to persist. On error, revert.
5. If no preferences row exists (shouldn't happen given the seed trigger, but defensive), fall back to `'peach'` / `'light'`.

### `differenceClass` update

`src/utils/money.ts`'s `differenceClass` currently returns hard-coded `text-green-600` / `text-red-600` / `text-gray-500`. It is updated to return `text-positive` / `text-negative` / `text-muted` so the colors track the active theme. The pure-function contract is unchanged — return type still `string`, still purely role+value based.

## 7. New API layer

### `src/api/preferences.ts`

```ts
type Preferences = { theme: Theme; mode: Mode };

getPreferences(): Promise<Preferences>
updatePreferences(patch: Partial<Preferences>): Promise<void>
```

`getPreferences` uses `select('theme, color_mode').eq('user_id', userId).single()` and maps `color_mode` → `mode` in the returned object. `updatePreferences` uses `.upsert()` (matching the v1 hardening pattern in `updateIncome`).

## 8. Component changes

### New components

- **`src/theme/ThemeProvider.tsx`** — context provider described in Section 6.
- **`src/components/Header.tsx`** — extracted from `App.tsx`. Renders logo, month label, mode toggle, Settings link, Log out.
- **`src/components/BalanceHero.tsx`** — the new "Where you stand" card. Receives projected balance, actual balance, and a derived narrative string. Lives at the top of the dashboard. The narrative is built by a pure helper in `utils/money.ts`:

  ```ts
  // Returns one sentence describing balance + income + cost direction.
  // Examples:
  //   "You're $155 behind projection — costs are up $35 and income is down $120."
  //   "You're $50 ahead of projection — costs are down $50 and income is on budget."
  //   "You're right on projection."
  function balanceNarrative(args: {
    projectedBalance: number;
    actualBalance: number;
    incomeProjected: number;
    incomeActual: number;
    costProjected: number;
    costActual: number;
  }): string;
  ```
  Narrative rules:
  - Balance delta: `actual − projected`. Positive → "ahead of projection". Negative → "behind projection". Zero → "right on projection." (sentence ends here).
  - Cost direction: `costActual − costProjected`. Positive → "costs are up $X". Negative → "costs are down $X". Zero → "costs are on budget".
  - Income direction: `incomeActual − incomeProjected`. Positive → "income is up $X". Negative → "income is down $X". Zero → "income is on budget".
  - All money values formatted via `formatMoney`.
- **`src/components/EmptyCategoryCard.tsx`** — dashed-border card with category icon + name + "+ Add first item" button. Used by `CategoryTable` when `items.length === 0`.
- **`src/pages/Settings.tsx`** — new page with color-mode toggle and three theme cards.
- **`src/components/ThemeCard.tsx`** — one theme option in the picker.

### Modified components

- **`App.tsx`** — wraps `BudgetApp` in `ThemeProvider`. Adds simple page routing (top-level state `'budget' | 'settings'`; no router library needed for two pages).
- **`IncomeSummary.tsx`** — restyled with new tokens. Computes the narrative string for `BalanceHero`. Layout grid moves from 3-col to a responsive 1/2/3-col depending on viewport.
- **`CategoryTable.tsx`** — when `items.length === 0`, renders `EmptyCategoryCard` instead of the table. When non-empty, restyled with new tokens, category icon next to the name, subtotal moves into the header row.
- **`LineItemRow.tsx`** — restyled with new tokens. **The +Add item draft flow moves out of `CategoryTable` into a new `DraftRow` subcomponent** that owns its own focus-tracking (see Section 9).
- **`GrandTotals.tsx`** — restyled as the dark "hero footer" using `bg-hero-bg` / `text-hero-text`.
- **Auth screens** (`Login`, `Signup`, `MFAEnroll`, `MFAChallenge`) — restyled with new tokens. Logo + tagline added. Layout otherwise unchanged.

### Category icon map

```ts
const CATEGORY_ICONS: Record<string, string> = {
  'Services':                '🛠',
  'Entertainment':           '🎬',
  'Loans':                   '🏦',
  'Taxes':                   '📋',
  'Savings or Investments':  '💎',
  'Monthly Payments':        '🧾',
  'Personal Care':           '🧴',
  'Other':                   '✨',
};
```

Lives in `src/utils/categoryIcons.ts`. Categories not in the map (none in v1.1) fall back to `'📁'`.

## 9. Improved +Add item flow

### Current behavior (v1)

Clicking "+ Add item" inserts a draft row with the name input focused. On `onBlur` of the name input, the draft commits if name is non-empty (otherwise discarded). The known problem: projected and actual inputs default to 0 and never get the user's typed values, because by the time the user reaches them, the draft has already committed.

### New behavior (v1.1)

A `DraftRow` component owns a single focusout handler attached to the row's container `<div>`. The draft commits when **focus leaves the entire row** (not just one field), or the user presses Enter inside any input, or it discards if the user presses Escape:

- `onFocusOut` on the container: uses `e.relatedTarget` to check whether the next focused element is still inside the row. If not, commit (name non-empty) or discard (name empty).
- `onKeyDown` on each input: `Enter` → commit; `Escape` → discard.

Implementation outline:

```tsx
function DraftRow({ onCommit, onDiscard }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [projected, setProjected] = useState('0');
  const [actual, setActual] = useState('0');

  function handleFocusOut(e: FocusEvent) {
    if (rowRef.current?.contains(e.relatedTarget as Node)) return;
    if (name.trim()) onCommit({ name, projected: Number(projected), actual: Number(actual) });
    else onDiscard();
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); commitNow(); }
    if (e.key === 'Escape') { e.preventDefault(); onDiscard(); }
  }

  return <div ref={rowRef} onBlur={handleFocusOut}>{/* three inputs */}</div>;
}
```

Edge case: clicking the trash icon mid-draft discards the row (no API call).

## 10. Mobile layout (≤640px)

A single Tailwind breakpoint (`sm:`, which is `640px`) drives the responsive changes. Mobile layout is the default; `sm:`+ tweaks add the desktop variant.

### Header
- Collapses logo + month + actions into: logo, hamburger (right). Hamburger opens a sheet with Settings / Log out / mode toggle.

### Balance hero
- Stacks vertically: Projected balance above Actual balance. Narrative text wraps freely.

### Income summary
- Grid goes from `grid-cols-3` to `grid-cols-2` (Projected/Actual inputs side by side, Difference below).

### Category tables
- Table flips to per-item cards. Each item shows name in a header, then a 3-column row of Projected/Actual/Difference labels + values.
- Subtotal stays at the bottom of the category section.

### Inputs
- Min font size 16px to prevent iOS Safari zoom-on-focus.

### Settings page
- Theme cards stack to `grid-cols-1` on mobile.

## 11. Accessibility

- **Contrast:** every theme × mode pair targets WCAG AA (4.5:1 for body text, 3:1 for large text). Specifically validated:
  - `text` on `bg` and `card`
  - `positive` and `negative` on `bg` and `card`
  - `hero-text` on `hero-bg`
- **Keyboard:**
  - All interactive elements (theme cards, mode toggle, Add item, ✕) reachable by Tab.
  - Focus rings rely on the browser default + a 2px outline in `--text`.
  - Enter / Escape on draft row (see Section 9).
- **Reduced motion:** no animations beyond `transition: background-color 0.15s ease` on hover. `@media (prefers-reduced-motion: reduce)` disables even this.
- **ARIA:**
  - Theme cards: `<button role="radio">` inside a `<div role="radiogroup" aria-label="Theme">`. The selected card has `aria-checked="true"`.
  - Mode toggle: pair of buttons with `aria-pressed`.
  - Empty-state cards: keep semantic markup (`<section>` + button), no special ARIA needed.

## 12. File structure changes

```
src/
├── App.tsx                           (modified — adds page routing + ThemeProvider)
├── themes.css                        (new — CSS variable definitions)
├── theme/
│   ├── ThemeProvider.tsx             (new)
│   └── types.ts                      (new — Theme, Mode unions)
├── api/
│   ├── budget.ts                     (unchanged)
│   └── preferences.ts                (new)
├── components/
│   ├── Header.tsx                    (new — extracted from App)
│   ├── BalanceHero.tsx               (new)
│   ├── IncomeSummary.tsx             (modified)
│   ├── BalanceCards.tsx              (removed — superseded by BalanceHero)
│   ├── CategoryTable.tsx             (modified)
│   ├── EmptyCategoryCard.tsx         (new)
│   ├── LineItemRow.tsx               (modified)
│   ├── DraftRow.tsx                  (new — extracted from CategoryTable)
│   ├── GrandTotals.tsx               (modified)
│   ├── ThemeCard.tsx                 (new)
│   └── LineItemRow.test.tsx          (modified to use new tokens — test logic unchanged)
├── pages/
│   └── Settings.tsx                  (new)
├── utils/
│   ├── money.ts                      (modified — token names)
│   ├── money.test.ts                 (mostly unchanged — only differenceClass return values change)
│   └── categoryIcons.ts              (new)
└── auth/                             (modified — restyle only, no logic change)
    ├── AuthGate.tsx                  (modified — wrap children in ThemeProvider AFTER aal2 check)
    ├── Login.tsx                     (restyled)
    ├── Signup.tsx                    (restyled)
    ├── MFAEnroll.tsx                 (restyled)
    └── MFAChallenge.tsx              (restyled)

supabase/migrations/
├── 0005_user_preferences.sql         (new)
└── 0006_extend_seed_trigger.sql      (new)
```

## 13. Testing

- **Existing tests:** `money.test.ts` still passes (the `differenceClass` return values change from `text-green-600`/`text-red-600`/`text-gray-500` to `text-positive`/`text-negative`/`text-muted`; the tests are updated to match).
- **`LineItemRow.test.tsx`:** existing 4 tests still pass after restyle (selectors don't depend on class names).
- **New tests:**
  - `DraftRow.test.tsx` — at least: commits on focus-out with non-empty name, discards on focus-out with empty name, commits on Enter, discards on Escape, commits via clicking outside the row, retains projected/actual values when committed.
  - `theme/ThemeProvider.test.tsx` — sets `data-theme` and `data-mode` on render, updates attributes when `setTheme`/`setMode` is called, calls `updatePreferences` with the new value, reverts on persistence failure.
  - `balanceNarrative` cases in `money.test.ts` — covers each branch of balance / cost / income direction (ahead/behind/even × each direction).

No new E2E tests in this iteration.

## 14. Out of scope (deferred to v1.2 or later)

- WebAuthn / passkey MFA factor (still in the v1 deferred list).
- Custom color picker beyond the three presets.
- Per-category icon customization.
- Animated transitions between themes.
- Reduced-density or compact mode.
- Charts and CSV export.
- Month rollover and historical view.

## 15. Migration plan / order of operations

1. Add `user_preferences` table + extended signup trigger (migrations 0005 and 0006).
2. Build CSS variable system (`themes.css`) and update `tailwind.config.js`.
3. Build `ThemeProvider` + `preferences` API + `Settings` page.
4. Refactor `LineItemRow` and `CategoryTable` to use new tokens + extract `DraftRow`.
5. Add `BalanceHero` (replacing `BalanceCards`).
6. Add `EmptyCategoryCard` and wire into `CategoryTable`.
7. Add `Header` + page-level routing in `App.tsx`.
8. Mobile responsive pass.
9. Restyle auth screens.
10. Accessibility audit (contrast, focus rings, ARIA).
11. Manual smoke test (full flow + theme switch + mobile via DevTools).

---

## Appendix A — Exact theme palette values

### Peach

| Token       | Light     | Dark      |
|-------------|-----------|-----------|
| `--bg`        | `#fef3ec` | `#2a1f1c` |
| `--card`      | `#ffffff` | `#3a2c28` |
| `--highlight` | `#f5d5c0` | `#5a3d35` |
| `--text`      | `#3d2c2e` | `#f5e6d3` |
| `--muted`     | `#a88373` | `#c4a896` |
| `--positive`  | `#86a578` | `#a3c897` |
| `--negative`  | `#b54545` | `#d97777` |
| `--dashed`    | `#e7c4ac` | `#6a5044` |
| `--hero-bg`   | `#3d2c2e` | `#f5e6d3` |
| `--hero-text` | `#fef3ec` | `#2a1f1c` |

### Sage

| Token       | Light     | Dark      |
|-------------|-----------|-----------|
| `--bg`        | `#f4f6ee` | `#1f2a1c` |
| `--card`      | `#ffffff` | `#2c3a28` |
| `--highlight` | `#d5e3c0` | `#3d5a35` |
| `--text`      | `#2e3d2c` | `#e6f0d3` |
| `--muted`     | `#8ca873` | `#a8c496` |
| `--positive`  | `#6a9558` | `#97c897` |
| `--negative`  | `#c05454` | `#d97777` |
| `--dashed`    | `#c7d8b3` | `#4a6a3a` |
| `--hero-bg`   | `#2e3d2c` | `#e6f0d3` |
| `--hero-text` | `#f4f6ee` | `#1f2a1c` |

### Lavender

| Token       | Light     | Dark      |
|-------------|-----------|-----------|
| `--bg`        | `#f5f0fa` | `#2a1f3a` |
| `--card`      | `#ffffff` | `#3a2c4a` |
| `--highlight` | `#e0d5f5` | `#5a3d6a` |
| `--text`      | `#3d2c4a` | `#f0e6f5` |
| `--muted`     | `#a888c4` | `#c4a8d8` |
| `--positive`  | `#7a9572` | `#a8c897` |
| `--negative`  | `#c05478` | `#d977a3` |
| `--dashed`    | `#d4c0e8` | `#4a3a5a` |
| `--hero-bg`   | `#3d2c4a` | `#f0e6f5` |
| `--hero-text` | `#f5f0fa` | `#2a1f3a` |
