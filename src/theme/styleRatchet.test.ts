import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const SRC = resolve(__dirname, '..');

/**
 * Files not yet migrated onto the type/radius/elevation tokens.
 *
 * This list only ever shrinks. Each restyle task deletes its own entries;
 * an empty array is the end state and this test then guards the whole app.
 * Adding a file back is a regression, not a fix.
 */
export const UNMIGRATED: string[] = [
  'auth/Login.tsx',
  'auth/MFAChallenge.tsx',
  'auth/MFAEnroll.tsx',
  'auth/Signup.tsx',
  'components/AccountRow.tsx',
  'components/AttachmentViewer.tsx',
  'components/CategoriesEditor.tsx',
  'components/CategoryRow.tsx',
  'components/ChangelogModal.tsx',
  'components/EmojiPicker.tsx',
  'components/ErrorBoundary.tsx',
  'components/ExchangeRatesPanel.tsx',
  'components/ExportButtons.tsx',
  'components/ProjectedVsActualChart.tsx',
  'components/ThemeCard.tsx',
  'components/Toast.tsx',
  'components/Wordmark.tsx',
  'pages/Accounts.tsx',
  'pages/Insights.tsx',
  'pages/Settings.tsx',
];

/**
 * Tailwind's own size, weight, radius and shadow utilities — the ones
 * chunk 1's tokens replace. An optional variant prefix (sm:, hover:,
 * dark:) is allowed before the utility and still matches.
 *
 * Deliberately NOT matched: colour utilities (text-muted, text-negative),
 * alignment (text-right, text-center), and rounded-full, which stays —
 * CategoryBudgetBar's progress fills are not chips, and --radius-chip is
 * documented as reserved for a pill component that does not exist.
 */
const BANNED =
  /(?:^|[\s"'`{(}])((?:[a-z-]+:)*)(text-(?:xs|sm|base|lg|xl|[2-9]xl)|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|rounded-(?:none|sm|md|lg|xl|[2-9]xl)|shadow-(?:2xs|xs|sm|md|lg|xl|[2-9]xl))(?=[\s"'`})]|$)/g;

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    if (!entry.endsWith('.tsx') || entry.endsWith('.test.tsx')) return [];
    return [full];
  });
}

function offendersIn(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(BANNED)].map((m) => `${m[1]}${m[2]}`);
}

describe('style ratchet', () => {
  const files = tsxFiles(SRC).map((f) => relative(SRC, f)).sort();

  for (const file of files) {
    const allowed = UNMIGRATED.includes(file);
    it(`${file} ${allowed ? '(not yet migrated)' : 'uses only token utilities'}`, () => {
      const found = offendersIn(join(SRC, file));
      if (allowed) {
        // A file on the allowlist is EXPECTED to still have offenders. When it
        // has none, it has been migrated and must come off the list — otherwise
        // the ratchet silently stops guarding it.
        expect(found.length, `${file} is clean — delete it from UNMIGRATED`).toBeGreaterThan(0);
      } else {
        expect(found, `${file} uses ad-hoc utilities: ${found.join(', ')}`).toEqual([]);
      }
    });
  }

  it('the allowlist names only files that exist', () => {
    // A stale entry would silently excuse nothing while looking like debt.
    for (const file of UNMIGRATED) {
      expect(files, `${file} is on UNMIGRATED but is not a source file`).toContain(file);
    }
  });
});
