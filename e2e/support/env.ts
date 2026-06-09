import { config as loadDotenv } from 'dotenv';

// Load harness secrets. Playwright's config also loads this, but importing here
// keeps support utilities usable standalone (e.g. the provisioning script).
loadDotenv({ path: '.env.e2e.local' });

type Required =
  | 'VITE_SUPABASE_URL'
  | 'VITE_SUPABASE_ANON_KEY'
  | 'E2E_USER_EMAIL'
  | 'E2E_USER_PASSWORD'
  | 'E2E_TOTP_SECRET'
  | 'SUPABASE_SERVICE_ROLE_KEY';

const REQUIRED: Required[] = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'E2E_USER_EMAIL',
  'E2E_USER_PASSWORD',
  'E2E_TOTP_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
];

function read(): Record<Required, string> {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `E2E env misconfigured. Missing: ${missing.join(', ')}.\n` +
        'Copy .env.e2e.local.example to .env.e2e.local (local) or set GitHub secrets (CI).',
    );
  }
  return Object.fromEntries(REQUIRED.map((k) => [k, process.env[k] as string])) as Record<
    Required,
    string
  >;
}

export const env = read();

export const APP_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
