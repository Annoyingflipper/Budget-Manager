import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { THEME_BG, backgroundFor } from './themeColors';
import type { Mode, Theme } from './types';

const THEMES: Theme[] = ['peach', 'sage', 'lavender'];
const MODES: Mode[] = ['light', 'dark'];

/**
 * Pulls the --bg declaration out of each `:root[data-theme=X][data-mode=Y]`
 * block in themes.css. The peach/light block is written as a grouped selector
 * (`:root, :root[data-theme="peach"][data-mode="light"]`), so the theme/mode
 * pair is matched anywhere inside the selector list rather than anchored.
 */
function bgFromCss(theme: Theme, mode: Mode): string {
  const css = readFileSync(resolve(__dirname, '../themes.css'), 'utf8');
  const blocks = css.split('}');
  const block = blocks.find(
    (b) =>
      b.includes(`[data-theme="${theme}"]`) &&
      b.includes(`[data-mode="${mode}"]`),
  );
  if (!block) throw new Error(`no themes.css block for ${theme}/${mode}`);
  const match = block.match(/--bg:\s*(#[0-9a-fA-F]{3,8})\s*;/);
  if (!match) throw new Error(`no --bg in ${theme}/${mode} block`);
  return match[1].toLowerCase();
}

describe('themeColors', () => {
  it('has an entry for every theme and mode', () => {
    for (const theme of THEMES) {
      for (const mode of MODES) {
        expect(THEME_BG[theme]?.[mode], `${theme}/${mode}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('matches the --bg declared in themes.css for all six combinations', () => {
    for (const theme of THEMES) {
      for (const mode of MODES) {
        expect(THEME_BG[theme][mode].toLowerCase(), `${theme}/${mode}`)
          .toBe(bgFromCss(theme, mode));
      }
    }
  });

  it('backgroundFor returns the mapped value', () => {
    expect(backgroundFor('sage', 'dark')).toBe(THEME_BG.sage.dark);
  });
});
