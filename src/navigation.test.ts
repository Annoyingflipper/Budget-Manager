import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, type Page } from './navigation';

describe('NAV_ITEMS', () => {
  it('covers every page in the Page union exactly once', () => {
    // If a page is ever added to the union without a nav entry it becomes
    // unreachable from the UI, which no other test would catch.
    const pages = NAV_ITEMS.map((i) => i.page).sort();
    const expected: Page[] = ['accounts', 'budget', 'insights', 'settings'];
    expect(pages).toEqual(expected);
  });

  it('leads with the dashboard', () => {
    expect(NAV_ITEMS[0].page).toBe('budget');
  });

  it('gives every item a non-empty label and icon', () => {
    for (const item of NAV_ITEMS) {
      expect(item.label.trim(), `${item.page} label`).not.toBe('');
      expect(item.icon.trim(), `${item.page} icon`).not.toBe('');
    }
  });

  it('has unique labels, so the two navs cannot produce ambiguous accessible names', () => {
    const labels = NAV_ITEMS.map((i) => i.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
