import type { Page } from '@playwright/test';

// Known-benign noise; extend deliberately with a comment per entry.
const ALLOWLIST: RegExp[] = [
  /Download the React DevTools/i,
  /\[vite\]/i,
  /favicon\.ico/i, // dev server has no favicon
  /Failed to fetch/i, // Supabase auth.getUser() in-flight requests aborted by page.reload()
  // Receipt thumbnails: specs run in parallel against one shared user, so a
  // signed URL can point at an object another spec has just deleted. The UI
  // degrades to a document icon; this is test-infrastructure noise, not a defect.
  /storage\/v1\/object\/sign\/receipts/,
];

function allowed(text: string): boolean {
  return ALLOWLIST.some((re) => re.test(text));
}

export function installConsoleGuard(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !allowed(msg.text())) errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    if (!allowed(err.message)) errors.push(`pageerror: ${err.message}`);
  });
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText ?? '';
    if (!allowed(req.url()) && failure !== 'net::ERR_ABORTED') {
      errors.push(`requestfailed: ${req.url()} (${failure})`);
    }
  });
  return errors;
}
