// Disaster-recovery dump of the Supabase public schema + auth user roster.
// Run with:
//   npm run backup            # every configured target
//   npm run backup -- prd     # just production
//   npm run backup -- qa
//
// Requires .env.backup.local (git-ignored) with, per target:
//   PRD_SUPABASE_URL / PRD_SUPABASE_SERVICE_ROLE_KEY
//   QA_SUPABASE_URL  / QA_SUPABASE_SERVICE_ROLE_KEY
// A target with no credentials is skipped, so you can back up only PRD.
//
// Output: backups/<target>/<utc-timestamp>/{<table>.json, manifest.json}
// The service-role key bypasses RLS, so this captures every user's rows —
// unlike the app, which is AAL2-gated and scoped to one user.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

loadDotenv({ path: '.env.backup.local' });

// Insert order for a restore: parents before children. line_items carries FKs
// to both categories and the owning user, so it must come last.
const TABLES = ['categories', 'income', 'line_items', 'user_preferences'] as const;

type Target = 'prd' | 'qa';
const ALL_TARGETS: Target[] = ['prd', 'qa'];

function credsFor(target: Target): { url: string; serviceRole: string } | null {
  const prefix = target.toUpperCase();
  const url = process.env[`${prefix}_SUPABASE_URL`];
  const serviceRole = process.env[`${prefix}_SUPABASE_SERVICE_ROLE_KEY`];
  if (!url || !serviceRole) return null;
  return { url, serviceRole };
}

async function backup(target: Target, stamp: string): Promise<boolean> {
  const creds = credsFor(target);
  if (!creds) {
    console.log(`⏭  ${target}: no credentials in .env.backup.local — skipped`);
    return false;
  }

  const db = createClient(creds.url, creds.serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const outDir = join('backups', target, stamp);
  mkdirSync(outDir, { recursive: true });

  const counts: Record<string, number> = {};

  for (const table of TABLES) {
    const { data, error } = await db.from(table).select('*');
    if (error) throw new Error(`${target}/${table}: ${error.message}`);
    const rows = data ?? [];
    writeFileSync(join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
    counts[table] = rows.length;
    console.log(`   ${table}: ${rows.length} rows`);
  }

  // The auth schema can't be migrated into a new project, but the id→email map
  // is what makes remapping user_id on a restore possible. Password hashes and
  // TOTP secrets are deliberately not exposed by this API — plan to re-enroll.
  const users: Array<{ id: string; email: string | undefined; created_at: string }> = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`${target}/auth.users: ${error.message}`);
    users.push(
      ...data.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at })),
    );
    if (data.users.length < 200) break;
  }
  writeFileSync(join(outDir, 'auth_users.json'), JSON.stringify(users, null, 2));
  counts['auth.users'] = users.length;
  console.log(`   auth.users: ${users.length} (id + email only)`);

  const manifest = {
    target,
    supabaseUrl: creds.url,
    takenAt: new Date().toISOString(),
    counts,
    // Schema lives in git, not in this dump. Record which migration the data
    // matches so a restore knows the tree state to check out and db push.
    schemaSource: 'supabase/migrations/',
    restoreOrder: TABLES,
    note: 'auth.users is a roster only. Re-signup + re-enroll TOTP on a new project, then remap user_id before importing.',
  };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`✅ ${target} → ${outDir}`);
  return true;
}

async function main() {
  const requested = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const targets: Target[] =
    requested.length === 0 || requested.includes('all')
      ? ALL_TARGETS
      : requested.map((a) => {
          if (a !== 'prd' && a !== 'qa') throw new Error(`Unknown target "${a}" (use prd|qa|all)`);
          return a;
        });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let done = 0;
  for (const target of targets) {
    console.log(`\n📦 ${target}`);
    if (await backup(target, stamp)) done++;
  }

  if (done === 0) {
    throw new Error(
      'Nothing backed up. Create .env.backup.local with PRD_SUPABASE_URL + PRD_SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  console.log(`\nBacked up ${done} of ${targets.length} target(s).`);
}

main().catch((e) => {
  console.error(`\n❌ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
