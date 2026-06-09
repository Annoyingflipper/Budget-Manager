// One-time, idempotent E2E test-user provisioning. Run with:
//   npm run e2e:provision
// Requires .env.e2e.local with VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
// E2E_USER_EMAIL, E2E_USER_PASSWORD, SUPABASE_SERVICE_ROLE_KEY.
// Prints E2E_TOTP_SECRET — copy it into .env.e2e.local and the GitHub secret.
import { config as loadDotenv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { authenticator } from 'otplib';

loadDotenv({ path: '.env.e2e.local' });

const url = req('VITE_SUPABASE_URL');
const anon = req('VITE_SUPABASE_ANON_KEY');
const serviceRole = req('SUPABASE_SERVICE_ROLE_KEY');
const email = req('E2E_USER_EMAIL');
const password = req('E2E_USER_PASSWORD');

function req(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Missing ${k} in .env.e2e.local`);
  return v;
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // 1. Create (or find) the user, email pre-confirmed.
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let userId = list.users.find((u) => u.email === email)?.id;
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`Created user ${email} (${userId})`);
  } else {
    console.log(`User ${email} already exists (${userId})`);
  }

  // 2. Sign in as the user (anon client) to enroll a TOTP factor.
  const userClient = createClient(url, anon, { auth: { persistSession: false } });
  const { error: signInErr } = await userClient.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;

  const { data: factors } = await userClient.auth.mfa.listFactors();
  if (factors?.totp.some((f) => f.status === 'verified')) {
    console.log('A verified TOTP factor already exists.');
    console.log('If you lost the secret, unenroll it in Supabase Auth and re-run.');
    return;
  }

  const { data: enroll, error: enrollErr } = await userClient.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'e2e',
  });
  if (enrollErr) throw enrollErr;
  const secret = enroll.totp.secret;

  // 3. Challenge + verify to mark the factor verified.
  const { data: challenge, error: chErr } = await userClient.auth.mfa.challenge({
    factorId: enroll.id,
  });
  if (chErr) throw chErr;
  const code = authenticator.generate(secret);
  const { error: verifyErr } = await userClient.auth.mfa.verify({
    factorId: enroll.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyErr) throw verifyErr;

  console.log('\n✅ TOTP factor enrolled + verified.');
  console.log('\nAdd this to .env.e2e.local and your GitHub secret E2E_TOTP_SECRET:\n');
  console.log(`E2E_TOTP_SECRET=${secret}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
