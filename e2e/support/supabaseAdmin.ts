import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Service-role client for TEST INFRA ONLY (seed/cleanup, provisioning).
// Bypasses RLS — never import this from src/. It has no auth.uid(), so it must
// write user_id explicitly and cannot call the AAL2-gated RPCs.
export const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function getTestUserId(email: string): Promise<string> {
  // Single dedicated test user; first page is enough.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`Test user not found: ${email}. Run npm run e2e:provision first.`);
  return user.id;
}
