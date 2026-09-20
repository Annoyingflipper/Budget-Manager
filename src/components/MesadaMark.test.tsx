import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import MesadaMark from './MesadaMark';

/**
 * sRGB relative luminance (WCAG definition): linearise each channel, then
 * weight by 0.2126R + 0.7152G + 0.0722B.
 */
function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const linearise = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [rl, gl, bl] = [r, g, b].map(linearise);
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function tokenFromBlock(block: string, token: string): string {
  const match = block.match(new RegExp(`--${token}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
  if (!match) throw new Error(`no --${token} in block`);
  return match[1];
}

/**
 * Pulls each `:root[data-theme=X][data-mode=Y]` block out of themes.css by
 * splitting on `}`, matching the theme/mode substrings anywhere in the
 * selector list. Mirrors the bgFromCss helper in src/theme/themeColors.test.ts
 * so the peach/light grouped selector (`:root, :root[data-theme="peach"]...`)
 * is handled the same way.
 */
function themeBlock(theme: 'peach' | 'sage' | 'lavender', mode: 'light' | 'dark'): string {
  const css = readFileSync(resolve(__dirname, '../themes.css'), 'utf8');
  const blocks = css.split('}');
  const block = blocks.find(
    (b) => b.includes(`[data-theme="${theme}"]`) && b.includes(`[data-mode="${mode}"]`),
  );
  if (!block) throw new Error(`no themes.css block for ${theme}/${mode}`);
  return block;
}

describe('MesadaMark', () => {
  it('renders an svg at the requested size', () => {
    const { container } = render(<MesadaMark size={48} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('height', '48');
  });

  it('draws three coin shapes', () => {
    const { container } = render(<MesadaMark />);
    expect(container.querySelectorAll('[data-coin]')).toHaveLength(3);
  });

  it('uses theme custom properties rather than hardcoded hex', () => {
    const { container } = render(<MesadaMark />);
    const markup = container.innerHTML;
    expect(markup).toContain('var(--');
    expect(markup).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it('is hidden from assistive tech by default', () => {
    const { container } = render(<MesadaMark />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('exposes an accessible name when given a title', () => {
    render(<MesadaMark title="Mesada" />);
    expect(screen.getByRole('img', { name: 'Mesada' })).toBeInTheDocument();
  });

  it('applies a passed className', () => {
    const { container } = render(<MesadaMark className="shrink-0" />);
    expect(container.querySelector('svg')).toHaveClass('shrink-0');
  });

  it('defines --positive-shade in all six theme blocks in themes.css', () => {
    const themes: Array<'peach' | 'sage' | 'lavender'> = ['peach', 'sage', 'lavender'];
    const modes: Array<'light' | 'dark'> = ['light', 'dark'];
    for (const theme of themes) {
      for (const mode of modes) {
        const block = themeBlock(theme, mode);
        expect(block, `${theme}/${mode}`).toMatch(/--positive-shade:\s*#[0-9a-fA-F]{3,8}\s*;/);
      }
    }
  });

  it('defines --neutral and --neutral-shade in all six theme blocks in themes.css', () => {
    const themes: Array<'peach' | 'sage' | 'lavender'> = ['peach', 'sage', 'lavender'];
    const modes: Array<'light' | 'dark'> = ['light', 'dark'];
    for (const theme of themes) {
      for (const mode of modes) {
        const block = themeBlock(theme, mode);
        expect(block, `${theme}/${mode}`).toMatch(/--neutral:\s*#[0-9a-fA-F]{3,8}\s*;/);
        expect(block, `${theme}/${mode}`).toMatch(/--neutral-shade:\s*#[0-9a-fA-F]{3,8}\s*;/);
      }
    }
  });

  // This is the test that would have caught the dark-mode inversion: a
  // presence check alone (the test above) passes whether or not the face is
  // actually lighter than the body. A coin whose edge (the "-shade" token)
  // is brighter than its face (the base token) reads as inverted — the top
  // face stops looking raised, and in the two neutral coins specifically
  // that collapse made them merge into a single pale cylinder under a green
  // lid. Asserting the luminance ordering directly is what catches that.
  it('face tokens (--positive, --neutral) are lighter than their -shade body tokens, in every theme block', () => {
    const themes: Array<'peach' | 'sage' | 'lavender'> = ['peach', 'sage', 'lavender'];
    const modes: Array<'light' | 'dark'> = ['light', 'dark'];
    for (const theme of themes) {
      for (const mode of modes) {
        const block = themeBlock(theme, mode);
        for (const pair of ['positive', 'neutral'] as const) {
          const face = relativeLuminance(tokenFromBlock(block, pair));
          const shade = relativeLuminance(tokenFromBlock(block, `${pair}-shade`));
          expect(
            face,
            `${theme}/${mode}: --${pair} should be lighter than --${pair}-shade`,
          ).toBeGreaterThan(shade);
        }
      }
    }
  });

  // Guards src/components/MesadaMark.tsx and public/icon.svg staying in sync.
  // icon.svg is a hand-maintained static twin of this component (it can't
  // read CSS custom properties, since it's served before React boots), and
  // its own comment says geometry must be kept in sync "by hand" — nothing
  // enforced that until this test. It compares only the ordered numeric
  // geometry attributes (position/size), never colour (hex in icon.svg vs
  // var(--...) here, which legitimately differ), and ignores icon.svg's
  // background plate rect, which has no counterpart in the component.
  it('keeps coin geometry in sync with public/icon.svg', () => {
    const componentSrc = readFileSync(resolve(__dirname, './MesadaMark.tsx'), 'utf8');
    const iconSvg = readFileSync(resolve(__dirname, '../../public/icon.svg'), 'utf8');

    const ATTR_ORDER = ['x', 'y', 'cx', 'cy', 'rx', 'ry', 'width', 'height'] as const;

    function extractGeometry(svgSource: string): number[] {
      const values: number[] = [];
      const shapeRegex = /<(rect|ellipse)\b([^>]*)\/?>/g;
      let match: RegExpExecArray | null;
      while ((match = shapeRegex.exec(svgSource))) {
        const [, tag, attrsStr] = match;
        // Skip icon.svg's background plate: the only rect with an rx
        // (rounded corner) — the coin rects never have one.
        if (tag === 'rect' && /\brx=/.test(attrsStr)) continue;
        for (const attr of ATTR_ORDER) {
          const attrMatch = attrsStr.match(new RegExp(`\\b${attr}="(-?[0-9.]+)"`));
          if (attrMatch) values.push(Number(attrMatch[1]));
        }
      }
      return values;
    }

    expect(extractGeometry(componentSrc)).toEqual(extractGeometry(iconSvg));
  });
});
