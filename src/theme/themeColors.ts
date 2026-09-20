import type { Mode, Theme } from './types';

/**
 * Background colour per theme × mode, mirroring the --bg custom property in
 * src/themes.css.
 *
 * This duplicates CSS on purpose. It feeds the <meta name="theme-color">
 * tag, which Chrome reads to tint the title bar of the installed standalone
 * window — and that has to be a real string before paint, not a computed
 * style. themeColors.test.ts parses themes.css and fails if the two drift,
 * so the CSS remains the source of truth.
 */
export const THEME_BG: Record<Theme, Record<Mode, string>> = {
  peach:    { light: '#fef3ec', dark: '#2a1f1c' },
  sage:     { light: '#f4f6ee', dark: '#1f2a1c' },
  lavender: { light: '#f5f0fa', dark: '#2a1f3a' },
};

export function backgroundFor(theme: Theme, mode: Mode): string {
  return THEME_BG[theme][mode];
}
