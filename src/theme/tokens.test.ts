import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio, relativeLuminance } from '../utils/contrast';

const THEMES = ['peach', 'sage', 'lavender'] as const;
const MODES = ['light', 'dark'] as const;

/**
 * Parses every `:root[data-theme=X][data-mode=Y]` block out of themes.css.
 * The peach/light block uses a grouped selector (`:root,` then the attribute
 * selector), which this handles because it matches the attribute substrings
 * anywhere in the block rather than anchoring to the start.
 */
function tokensFor(theme: string, mode: string): Record<string, string> {
  const css = readFileSync(resolve(__dirname, '../themes.css'), 'utf8');
  const block = css
    .split('}')
    .find((b) => b.includes(`[data-theme="${theme}"]`) && b.includes(`[data-mode="${mode}"]`));
  if (!block) throw new Error(`no themes.css block for ${theme}/${mode}`);
  return Object.fromEntries(
    [...block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2].toLowerCase()]),
  );
}

/** Tokens that are rendered as text and therefore owe WCAG AA at body size. */
const TEXT_TOKENS = ['text', 'muted', 'positive', 'negative', 'warning'] as const;

describe('colour tokens meet WCAG AA', () => {
  for (const theme of THEMES) {
    for (const mode of MODES) {
      for (const token of TEXT_TOKENS) {
        it(`${theme}/${mode}: --${token} clears 4.5:1 on both --bg and --card`, () => {
          const t = tokensFor(theme, mode);
          // Both surfaces are asserted so it does not matter which one binds.
          expect(contrastRatio(t[token], t.bg), `--${token} on --bg`).toBeGreaterThanOrEqual(4.5);
          expect(contrastRatio(t[token], t.card), `--${token} on --card`).toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});

describe('colour tokens meet WCAG AA on the surfaces they actually render on', () => {
  // GrandTotals renders its diff figure on --hero-bg, not --bg/--card — a
  // regression (v2.2 chunk 1's fix wave) shipped because the surface list
  // above was fixed at --bg/--card and never re-checked against where
  // components actually paint text. --positive-on-hero/--negative-on-hero
  // exist because a single --positive/--negative cannot clear 4.5:1 on both
  // --bg (needs luminance <=0.162) and --hero-bg (needs luminance >=0.302)
  // at once. This surface list must keep growing as components are audited
  // for what they render on — it is not exhaustive by construction.
  const HERO_TEXT_TOKENS = ['positive-on-hero', 'negative-on-hero'] as const;

  for (const theme of THEMES) {
    for (const mode of MODES) {
      for (const token of HERO_TEXT_TOKENS) {
        it(`${theme}/${mode}: --${token} clears 4.5:1 on --hero-bg`, () => {
          const t = tokensFor(theme, mode);
          expect(contrastRatio(t[token], t['hero-bg']), `--${token} on --hero-bg`)
            .toBeGreaterThanOrEqual(4.5);
        });
      }
    }
  }
});

describe('shaded token pairs stay visibly separated', () => {
  // A "shade" is the darker companion used for a surface's edge — the coin's
  // rim in MesadaMark. Strict ordering is not enough: v2.2's contrast work
  // darkened --positive far enough that peach/light's existing shade landed at
  // 97% of the face's luminance. That passes "is it darker?" while rendering
  // as a flat blob. The gap is what matters, so the gap is what is asserted.
  const PAIRS = [
    ['positive', 'positive-shade'],
    ['neutral', 'neutral-shade'],
  ] as const;

  for (const theme of THEMES) {
    for (const mode of MODES) {
      for (const [face, shade] of PAIRS) {
        it(`${theme}/${mode}: --${shade} is meaningfully darker than --${face}`, () => {
          const t = tokensFor(theme, mode);
          const ratio = relativeLuminance(t[shade]) / relativeLuminance(t[face]);
          expect(ratio, `--${shade} is ${Math.round(ratio * 100)}% of --${face}'s luminance`)
            .toBeLessThanOrEqual(0.85);
        });
      }
    }
  }
});

describe('typography scale', () => {
  const tokensCss = readFileSync(resolve(__dirname, '../tokens.css'), 'utf8');

  const STEPS = ['display', 'title', 'heading', 'body', 'label', 'caption', 'money'] as const;

  for (const step of STEPS) {
    it(`--text-${step} defines a size, a line-height and a weight`, () => {
      // Every step carries all three so a caller picks a ROLE, not a size —
      // which is what stops line-height and weight being re-decided per
      // component, the thing that made the old UI feel unsystematic.
      expect(tokensCss, `--text-${step} size`).toMatch(
        new RegExp(`--text-${step}:\\s*[0-9.]+rem`),
      );
      expect(tokensCss, `--text-${step} line-height`).toMatch(
        new RegExp(`--text-${step}--line-height:\\s*[0-9.]+`),
      );
      expect(tokensCss, `--text-${step} weight`).toMatch(
        new RegExp(`--text-${step}--font-weight:\\s*[0-9]{3}`),
      );
    });
  }

  it('sizes descend monotonically from display to caption', () => {
    const sizeOf = (step: string) => {
      const m = tokensCss.match(new RegExp(`--text-${step}:\\s*([0-9.]+)rem`));
      if (!m) throw new Error(`no --text-${step}`);
      return Number(m[1]);
    };
    const ordered = ['display', 'title', 'heading', 'body', 'label', 'caption'];
    const sizes = ordered.map(sizeOf);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i], `${ordered[i]} must be smaller than ${ordered[i - 1]}`)
        .toBeLessThan(sizes[i - 1]);
    }
  });

  it('provides a mid weight between normal and bold', () => {
    // The app had only 400, 700 and 800 — nothing for labels and column
    // headers, so they were set in bold and competed with real headings.
    const weights = [...tokensCss.matchAll(/--text-[a-z]+--font-weight:\s*(\d{3})/g)]
      .map((m) => Number(m[1]));
    expect(weights.some((w) => w >= 500 && w <= 600)).toBe(true);
  });

  it('money uses tabular numerals so columns align', () => {
    // Tailwind only wires up --line-height / --letter-spacing / --font-weight
    // as --text-* theme-key suffixes — a --font-variant-numeric suffix would
    // compile to a dangling custom property nothing reads (confirmed against
    // node_modules/tailwindcss/dist/lib.js). So this is applied via a real
    // @utility block instead, which this asserts the source declares.
    // Whether Tailwind actually *emits* tabular-nums for .text-money is
    // proven separately, from compiled output, by
    // scripts/check-bundle-size.ts — a source-text regex like this one
    // cannot catch a token Tailwind silently ignores.
    expect(tokensCss).toMatch(
      /@utility\s+text-money\s*\{[^}]*font-variant-numeric:\s*tabular-nums[^}]*\}/,
    );
  });

  it('the scale is exposed to Tailwind through the @theme block', () => {
    const indexCss = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    expect(indexCss).toMatch(/@import\s+['"]\.\/tokens\.css['"]/);
  });
});

describe('radius', () => {
  // --radius-control/--radius-card/--radius-chip previously had no coverage
  // at all: no source test here, and check-bundle-size.ts's compiled-output
  // section only covered --text-*/.text-money. This is the one token family
  // chunk 2/3 touches most (the row/table-input radius migration BRAND.md
  // §5 flags as open), so it's the one most worth guarding before that work
  // starts. The compiled-output half of this guard (proving Tailwind
  // actually emits .rounded-control/.rounded-card/.rounded-chip resolving
  // to these custom properties, not just that the source declares them) is
  // in scripts/check-bundle-size.ts, for the same reason section 4/5 of that
  // script exists rather than being a Vitest test — see that file's header.
  const tokensCss = readFileSync(resolve(__dirname, '../tokens.css'), 'utf8');

  const RADII = [
    ['control', '0.5rem'],
    ['card', '0.75rem'],
    ['chip', '9999px'],
  ] as const;

  for (const [name, value] of RADII) {
    it(`--radius-${name} is declared in src/tokens.css`, () => {
      expect(tokensCss).toMatch(new RegExp(`--radius-${name}:\\s*${value.replace('.', '\\.')}\\b`));
    });
  }
});

describe('elevation', () => {
  for (const theme of THEMES) {
    for (const mode of MODES) {
      it(`${theme}/${mode} defines all three elevation levels`, () => {
        const css = readFileSync(resolve(__dirname, '../themes.css'), 'utf8');
        const block = css
          .split('}')
          .find((b) => b.includes(`[data-theme="${theme}"]`) && b.includes(`[data-mode="${mode}"]`))!;
        for (const level of ['--elev-1', '--elev-2', '--elev-3']) {
          expect(block, `${theme}/${mode} ${level}`).toContain(level);
        }
      });
    }
  }

  it('dark modes use stronger shadow alpha than light modes', () => {
    // On a dark surface a soft light-mode shadow is invisible. Depth in dark
    // themes comes mostly from --card being lighter than --bg, but what
    // shadow there is has to be deeper to register at all.
    const css = readFileSync(resolve(__dirname, '../themes.css'), 'utf8');
    const alphaOf = (theme: string, mode: string) => {
      const block = css
        .split('}')
        .find((b) => b.includes(`[data-theme="${theme}"]`) && b.includes(`[data-mode="${mode}"]`))!;
      const m = block.match(/--elev-2:[^;]*rgba\([^)]*,\s*([0-9.]+)\)/);
      if (!m) throw new Error(`no --elev-2 rgba alpha in ${theme}/${mode}`);
      return Number(m[1]);
    };
    for (const theme of THEMES) {
      expect(alphaOf(theme, 'dark'), `${theme} dark --elev-2 alpha`)
        .toBeGreaterThan(alphaOf(theme, 'light'));
    }
  });

  it('exposes elevation to Tailwind as shadow utilities', () => {
    const indexCss = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    for (const n of [1, 2, 3]) {
      expect(indexCss).toMatch(new RegExp(`--shadow-e${n}:\\s*var\\(--elev-${n}\\)`));
    }
  });
});

describe('focus ring', () => {
  // A focus ring can land on any surface in the app, so it owes WCAG's 3:1
  // non-text contrast against all three — including --hero-bg, which is why
  // --text cannot serve: --text IS --hero-bg in every theme (ratio 1.00), so a
  // --text ring would be invisible on the GrandTotals card.
  for (const theme of THEMES) {
    for (const mode of MODES) {
      it(`${theme}/${mode}: --focus clears 3:1 on --bg, --card and --hero-bg`, () => {
        const t = tokensFor(theme, mode);
        expect(t.focus, `${theme}/${mode} --focus is defined`).toMatch(/^#[0-9a-f]{6}$/);
        for (const surface of ['bg', 'card', 'hero-bg'] as const) {
          expect(contrastRatio(t.focus, t[surface]), `--focus on --${surface}`)
            .toBeGreaterThanOrEqual(3);
        }
      });
    }
  }

  it('is exposed to Tailwind and drives a global focus-visible outline', () => {
    const indexCss = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    expect(indexCss).toMatch(/--color-focus:\s*var\(--focus\)/);
    // The base rule is what makes focus visible everywhere without every
    // component remembering to style it.
    expect(indexCss).toMatch(/:focus-visible/);
  });
});
