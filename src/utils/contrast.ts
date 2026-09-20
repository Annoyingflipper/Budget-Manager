/**
 * sRGB relative luminance and contrast ratio, per the WCAG 2.1 definition.
 *
 * Used by the token tests to assert accessibility and shading invariants as
 * arithmetic rather than opinion. Nothing in the app imports this, so it is
 * tree-shaken out of the production bundle.
 */

function channel(srgb: number): number {
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/** 0 for black, 1 for white. Accepts `#rrggbb` or `rrggbb`, any case. */
export function relativeLuminance(hex: string): number {
  const h = hex.replace(/^#/, '').toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(h)) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 1 (identical) to 21 (black on white). Symmetric in its arguments. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
