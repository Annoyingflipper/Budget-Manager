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
