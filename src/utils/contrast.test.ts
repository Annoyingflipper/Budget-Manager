import { describe, it, expect } from 'vitest';
import { relativeLuminance, contrastRatio } from './contrast';

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('accepts a hex with or without the leading hash', () => {
    expect(relativeLuminance('ffffff')).toBeCloseTo(relativeLuminance('#ffffff'), 10);
  });

  it('is case-insensitive', () => {
    expect(relativeLuminance('#AABBCC')).toBeCloseTo(relativeLuminance('#aabbcc'), 10);
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black on white, the maximum', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 2);
  });

  it('is 1:1 for a colour against itself', () => {
    expect(contrastRatio('#86685b', '#86685b')).toBeCloseTo(1, 5);
  });

  it('is symmetric — argument order does not matter', () => {
    expect(contrastRatio('#3d2c2e', '#fef3ec'))
      .toBeCloseTo(contrastRatio('#fef3ec', '#3d2c2e'), 10);
  });

  it('matches a known published value (#767676 on white is the AA threshold)', () => {
    // 4.54:1 — the canonical "lightest grey that passes AA on white".
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(4.5);
  });
});
