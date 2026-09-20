# v2.2 — Mesada: design language, app shell, and brand manual

**Date:** 2026-09-20
**Status:** Approved for planning
**Ships as:** v2.2 (QA → PRD, own smoke cycle)
**Depends on:** [v2.1 install + identity](./2026-09-20-mesada-pwa-branding-design.md) — must be shipped to PRD first

## Why

v2.1 puts a polished, Apple-quality icon in the macOS Dock. Clicking it opens a UI that does not match it: a centered single column with browser-style top navigation, an ad-hoc type scale, and spacing chosen per component rather than from a system.

That gap is the point of this version. An app launched from the Dock is judged against native apps, and top-of-page button navigation reads as a web page in a window.

There is also standing debt this is the natural moment to clear. The project's own notes record that the dashboard has pre-existing accessibility findings — the projected and actual inputs have no labels, and some text fails contrast — which surfaced when the receipts axe scan was briefly run unscoped. The existing a11y specs only cover Settings and the receipt viewer, so nothing catches this today. Restyling every input is exactly when those labels get added.

## Reference

Direction agreed from generated mockups, stored in `assets/2026-09-20-mesada/`:

- `ui-reference-desktop-light.png`
- `ui-reference-desktop-dark.png`
- `ui-reference-mobile.png`

**These are mood references, not specifications.** They contain invented app names, fabricated numbers, and features this app does not have (global search, goals, avatars, greetings). Implement the *layout language* — sidebar, card elevation, spacing rhythm, type hierarchy, row treatment — and nothing else from them.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Navigation | **Sidebar on desktop, bottom tab bar on mobile** | A sidebar reads as a native app; it does not fit a phone. `useIsMobile` already exists to branch on. |
| Scope | **Visual language + navigation + written brand manual** | Chosen over visual-only. Acknowledged as the most expensive option on the table. |
| Palette | **Keep Peach / Sage / Lavender × light / dark** | The warm palette is distinctive and already themed end to end. This version refines the tokens; it does not replace the identity. |
| a11y debt | **In scope** | Every input is being restyled anyway. Fixing labels separately would mean touching them twice. |

### Explicit non-goals

- No new features. Nothing gains functionality it does not have on 2026-09-20.
- No schema, RLS, auth, or migration changes. Entirely client-side.
- No new runtime dependency — no component library, no CSS-in-JS, no icon package. Tailwind v4 plus the existing token system is the whole toolkit.
- No change to the identity chosen in v2.1.
- Global search, goals, and avatars appear in the reference mockups and are **not** being built.

## Architecture

### 1. App shell

`App.tsx` currently owns a `Page` union (`'dashboard' | 'insights' | 'accounts' | 'settings'`) and `Header.tsx` owns both the navigation buttons and the month switcher. These are two different concerns wearing one component.

They separate into:

| Component | Responsibility |
|---|---|
| `AppShell` | Layout frame. Chooses sidebar or tab bar from `useIsMobile`. Owns nothing else. |
| `SidebarNav` | Desktop navigation: wordmark, the four destinations, theme toggle, sign out. |
| `TabBarNav` | Mobile navigation: the same four destinations as a bottom bar. |
| `Toolbar` | Month switcher, rollover, delete-month. **Dashboard-only and contextual** — it is not navigation and does not belong in the sidebar. |

Keeping the month switcher out of the sidebar is deliberate. It acts on the dashboard's content, not on which page is shown; putting it in global navigation would imply it applies to Settings and Accounts, which it does not.

`Header.tsx` is removed once its two halves land. `Header.test.tsx` is rewritten against the new components.

### 2. Design tokens

Today `src/themes.css` defines eleven colour variables per theme and nothing else. Spacing, type sizes, radii, and shadows are chosen per component, which is why the current UI has no rhythm.

This version adds systematic scales, exposed through the Tailwind v4 `@theme` block in `src/index.css` (there is no `tailwind.config.js` — Tailwind v4 is CSS-first here):

- **Type scale** — a fixed ramp with defined weight and line-height per step. Money figures get their own tabular-numeral treatment so columns align.
- **Spacing ramp** — one scale, used everywhere. No more per-component values.
- **Radius scale** — distinct values for cards, controls, and chips.
- **Elevation** — a small set of shadow tokens, defined per mode. Dark mode uses layered surface lightness rather than heavier shadows, because shadows do not read on dark backgrounds.

Colour tokens are refined, not replaced. The light-mode `--muted` values darkened in an earlier version to clear AA must not regress; the contrast tests guard them.

### 3. Brand manual

`docs/BRAND.md`, committed to the repo: the mark and its clear-space and minimum-size rules, the wordmark, the full colour token table with contrast ratios, the type scale, the spacing and radius ramps, elevation rules, component rules (card, row, input, button, chip, bar), and voice notes for user-facing copy.

The point is that later changes have something to conform to. A brand manual that lives only in generated images cannot tell anyone a type scale.

### 4. Accessibility

- Every input gets a programmatic label. The projected and actual money inputs are the known offenders.
- All text meets WCAG AA (≥4.5:1 for body, ≥3:1 for large) in all six theme × mode combinations.
- The sidebar and tab bar are real navigation landmarks with correct current-page state.
- Focus is visible on every interactive element, and focus order survives the layout change.
- **The dashboard axe scan runs unscoped.** Receipts' scan is currently narrowed to the dialog specifically because the dashboard behind it fails. Removing that workaround is the acceptance criterion.

### 5. Performance

v2.1's route-level code splitting and its enforced bundle budget **carry forward**. The shell restructure touches exactly the routing code where the `React.lazy` boundaries live, which is the most likely place for the split to be undone by accident — the budget test exists to catch that.

If the new shell genuinely requires more initial JavaScript, the budget is re-baselined in the same commit with the reason recorded. It is not deleted.

## Testing

**Test-first, without exception.** This version breaks more existing tests than any before it, which makes the discipline more important rather than less:

> When a change breaks a test, rewrite that test to express the new intended behaviour and run it red **first**. Only then change the implementation. Never adjust the implementation and retrofit the test to whatever it now does — a test written to match existing behaviour has never been observed to fail and proves nothing.

### Expected to need rewriting

- `Header.test.tsx` — the component is being removed; rewritten as `SidebarNav`, `TabBarNav`, and `Toolbar` tests.
- `App.test.tsx` — page switching moves into the shell.
- E2E page objects `DashboardPage`, `SettingsPage`, `InsightsPage`, `AccountsPage` — navigation selectors change.
- `theme-switching.e2e.ts` — the theme control moves into the sidebar.

Each is rewritten deliberately and run red before the corresponding implementation.

### New coverage

| Area | Assertions |
|---|---|
| `AppShell` | Renders `SidebarNav` on desktop and `TabBarNav` on mobile; switches on viewport. |
| `SidebarNav` / `TabBarNav` | All four destinations reachable; current page marked; keyboard navigable. |
| `Toolbar` | Appears on the dashboard only; month switching, rollover, and delete behave as before. |
| Tokens | Type, spacing, radius and elevation tokens resolve in all six theme × mode combinations. |
| Contrast | Every text token meets AA against its background, in all six combinations. |
| Bundle budget | Carried forward from v2.1, unchanged unless consciously re-baselined. |

### Playwright

- New `e2e/specs/app-shell.e2e.ts` — sidebar navigation on desktop, tab bar on mobile viewport, current-page state, keyboard traversal.
- **`e2e/specs/a11y.e2e.ts` gains an unscoped dashboard axe scan** against the full `wcag2a`/`wcag2aa` ruleset, matching how the Settings scan already runs. This is the acceptance test for the a11y debt.
- Receipts' scan has its dialog-only narrowing removed once the dashboard passes clean.

## Risks

| Risk | Mitigation |
|---|---|
| This is the largest refactor in the project's history and touches a large share of 395 tests. | Sequenced so the token system lands and is verified before any layout moves. Tokens first, shell second, restyle third — each independently green. |
| A restyle can silently break behaviour that unit tests do not cover. | The E2E suite exercises real user flows against a real backend and is the backstop. It must be green on QA before the merge to `main` is even proposed. |
| The sidebar could regress mobile, which is where a budgeting app is most used. | Mobile gets its own navigation rather than a squeezed sidebar, and the mobile viewport is tested explicitly rather than assumed. |
| Fixing a11y and restyling simultaneously makes it harder to tell which change caused a regression. | The unscoped axe scan is written and run red before the restyle begins, so a11y progress is measured continuously rather than asserted at the end. |
| Scope creep from the reference mockups — search, goals, avatars are visible in them and are tempting. | Listed as explicit non-goals above. |

## Rollout

Same flow as every version, and the dependency on v2.1 is strict:

1. **v2.1 must be live on PRD first.** Shipping a rebranded UI before the identity it is built around would invert the sequence.
2. Implement on `staging`, subagent-driven, one task per subagent, each with the test-first requirement stated in its prompt.
3. Push to `staging`; QA deploy green; full Vitest and Playwright suites green.
4. User smokes the QA URL on both desktop and mobile, as an installed app and in the browser, across all three themes in both modes.
5. User explicitly authorizes the push to `main`.
6. Fast-forward merge; PRD deploys.
7. User smokes PRD.
8. Notion `v2.2 Smoke Tests` sub-page created under the hub and linked from the Versions index.
