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

  it('pins the red and blue coefficients with chromatic tests', () => {
    // All previous tests use grayscale (R=G=B) so transposing the R/B coefficients
    // would still pass. These chromatic values catch that transposition:
    // #ff0000 (pure red) becomes 8.5925 if R and B coefficients are swapped.
    // #0000ff (pure blue) becomes 3.9985 if R and B coefficients are swapped.
    // Either one alone catches the error; together they guard against silent regression.
    expect(contrastRatio('#ff0000', '#ffffff')).toBeCloseTo(3.9985, 3);
    expect(contrastRatio('#0000ff', '#ffffff')).toBeCloseTo(8.5925, 3);
  });
});

describe('relativeLuminance error handling', () => {
  it('throws for a 3-digit hex', () => {
    expect(() => relativeLuminance('#abc')).toThrow('not a 6-digit hex colour: #abc');
  });

  it('throws for an 8-digit hex with alpha', () => {
    expect(() => relativeLuminance('#aabbccdd')).toThrow('not a 6-digit hex colour: #aabbccdd');
  });

  it('throws for a named colour', () => {
    expect(() => relativeLuminance('red')).toThrow('not a 6-digit hex colour: red');
  });

  it('throws for rgb() notation', () => {
    expect(() => relativeLuminance('rgb(0,0,0)')).toThrow('not a 6-digit hex colour: rgb(0,0,0)');
  });

  it('throws for an empty string', () => {
    expect(() => relativeLuminance('')).toThrow('not a 6-digit hex colour: ');
  });
});
