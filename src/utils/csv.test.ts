import { describe, it, expect } from 'vitest';
import { escapeCsvField, toCsv } from './csv';

describe('escapeCsvField', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCsvField('Food')).toBe('Food');
    expect(escapeCsvField(42)).toBe('42');
  });

  it('quotes and doubles quotes when the field contains comma, quote, or newline', () => {
    expect(escapeCsvField('Rent, June')).toBe('"Rent, June"');
    expect(escapeCsvField('Say "hi"')).toBe('"Say ""hi"""');
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('toCsv', () => {
  it('joins headers and rows with CRLF, escaping fields', () => {
    const csv = toCsv(
      ['Month', 'Item'],
      [
        ['2026-06-01', 'Food'],
        ['2026-06-01', 'Rent, June'],
      ],
    );
    expect(csv).toBe('Month,Item\r\n2026-06-01,Food\r\n2026-06-01,"Rent, June"');
  });
});
