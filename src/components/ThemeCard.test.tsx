import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * ThemeCard hardcodes a [bg, highlight, positive, negative] swatch array per
 * light theme rather than reading themes.css at runtime (it needs to render
 * before the corresponding theme is active, since it's how the user picks
 * one). That makes the swatches a second, hand-maintained copy of four
 * themes.css tokens per theme — v2.2 chunk 1's contrast fix wave retuned
 * --positive/--negative and left ThemeCard's swatches on the old values, so
 * the picker previewed colours the app no longer used. Guards against that
 * recurring, following the pattern src/theme/themeColors.test.ts already
 * uses to bind a hardcoded TS value back to themes.css.
 */
function lightBlock(theme: 'peach' | 'sage' | 'lavender'): string {
  const css = readFileSync(resolve(__dirname, '../themes.css'), 'utf8');
  const blocks = css.split('}');
  const block = blocks.find(
    (b) => b.includes(`[data-theme="${theme}"]`) && b.includes('[data-mode="light"]'),
  );
  if (!block) throw new Error(`no themes.css light block for ${theme}`);
  return block;
}

function tokenFrom(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!match) throw new Error(`no --${name} in block`);
  return match[1].toLowerCase();
}

describe('ThemeCard swatches match themes.css', () => {
  const themeCardSrc = readFileSync(resolve(__dirname, './ThemeCard.tsx'), 'utf8');

  const THEMES = ['peach', 'sage', 'lavender'] as const;

  for (const theme of THEMES) {
    it(`${theme}: swatch array matches --bg/--highlight/--positive/--negative`, () => {
      const block = lightBlock(theme);
      const expected = [
        tokenFrom(block, 'bg'),
        tokenFrom(block, 'highlight'),
        tokenFrom(block, 'positive'),
        tokenFrom(block, 'negative'),
      ];

      // Pull the `theme: { ... swatches: [...] }` entry out of ThemeCard's
      // source text rather than importing META (it isn't exported), the
      // same "parse the source" approach MesadaMark.test.tsx uses for
      // icon.svg parity.
      const entryMatch = themeCardSrc.match(
        new RegExp(`${theme}:\\s*\\{[\\s\\S]*?swatches:\\s*\\[([^\\]]*)\\]`),
      );
      if (!entryMatch) throw new Error(`no ${theme} entry with a swatches array in ThemeCard.tsx`);
      const actual = [...entryMatch[1].matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0].toLowerCase());

      expect(actual, `${theme} swatches`).toEqual(expected);
    });
  }
});
