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
export const UNMIGRATED: string[] = [];

/**
 * Tailwind's own size, weight, radius and shadow utilities — the ones
 * chunk 1's tokens replace. An optional variant prefix (sm:, hover:,
 * dark:) is allowed before the utility and still matches.
 *
 * Deliberately NOT matched: colour utilities (text-muted, text-negative),
 * alignment (text-right, text-center), rounded-full, which stays —
 * CategoryBudgetBar's progress fills are not chips, and --radius-chip is
 * documented as reserved for a pill component that does not exist — and
 * any non-type arbitrary value (`min-w-[200px]`, `max-h-[70vh]`, …): only
 * `text-[…]` arbitrary values are banned, since those are the ones that
 * bypass the type scale.
 */
const BANNED =
  /(?:^|[\s"'`{(}])((?:[a-z-]+:)*)(text-(?:xs|sm|base|lg|xl|[2-9]xl)|text-\[[^\]]*\]|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|leading-(?:none|tight|snug|normal|relaxed|loose|[0-9]+|\[[^\]]*\])|rounded-(?:none|sm|md|lg|xl|[2-9]xl)|rounded-(?:tl|tr|br|bl|ss|se|es|ee|t|r|b|l|s|e)(?:-[a-z0-9]+)?|rounded(?!-)|shadow-(?:2xs|xs|sm|md|lg|xl|[2-9]xl|inner|none))(?=[\s"'`})]|$)/g;

/**
 * Strips `//` line comments and `/* … *\/` block comments before the BANNED
 * scan runs, so a comment that *names* a banned class (e.g. "don't use
 * font-bold here") isn't itself reported as a violation — the scan is meant
 * to catch the class in use, not the word describing the rule.
 *
 * Deliberately a small hand-rolled scanner rather than a stripped-down
 * regex: it tracks whether it is inside a string literal (single, double
 * or backtick-quoted, respecting `\`-escapes) and only treats `//` / `/* `
 * as comment starts *outside* one, so a `//` inside a URL string like
 * "https://example.com" is left alone.
 */
export function stripComments(text: string): string {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i++;
      while (i < n && text[i] !== quote) {
        if (text[i] === '\\' && i + 1 < n) {
          out += text[i] + text[i + 1];
          i += 2;
          continue;
        }
        out += text[i];
        i++;
      }
      if (i < n) { out += text[i]; i++; } // closing quote
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i = Math.min(i + 2, n); // skip the closing */
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Pure text→offenders scan, factored out so it's testable without hitting the filesystem. */
export function bannedInText(text: string): string[] {
  return [...stripComments(text).matchAll(BANNED)].map((m) => `${m[1]}${m[2]}`);
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    if (!entry.endsWith('.tsx') || entry.endsWith('.test.tsx')) return [];
    return [full];
  });
}

function offendersIn(file: string): string[] {
  return bannedInText(readFileSync(file, 'utf8'));
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

  describe('comment stripping', () => {
    it('ignores a banned class named inside a line comment', () => {
      const text = [
        '// Do not use font-bold here — pick a text-* step instead.',
        'const x = 1;',
      ].join('\n');
      expect(bannedInText(text)).toEqual([]);
    });

    it('ignores a banned class named inside a block comment', () => {
      const text = '/* rounded-lg was here before the migration */\nconst x = 1;';
      expect(bannedInText(text)).toEqual([]);
    });

    it('still catches the same class when it is a real className', () => {
      const text = '<div className="font-bold" />';
      expect(bannedInText(text)).toEqual(['font-bold']);
    });

    it('does not treat // inside a URL string as a comment start', () => {
      const text = '<a href="https://example.com" className="font-bold">x</a>';
      expect(bannedInText(text)).toEqual(['font-bold']);
    });
  });
});
