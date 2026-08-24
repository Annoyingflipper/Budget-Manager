import { supabase } from '../lib/supabase';
import type { Currency } from '../utils/currency';
import type { Preferences, Theme, Mode } from '../theme/types';

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

export async function getLastSeenChangelogVersion(): Promise<string | null> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('user_preferences')
    .select('last_seen_changelog_version')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.last_seen_changelog_version ?? null;
}

/** Display-only: the currency the accounts grand total is expressed in. */
export async function getBaseCurrency(): Promise<Currency> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('user_preferences')
    .select('base_currency')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.base_currency as Currency | undefined) ?? 'USD';
}

export async function setBaseCurrency(currency: Currency): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        base_currency: currency,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
}

export async function setLastSeenChangelogVersion(version: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        last_seen_changelog_version: version,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
}

export async function getPreferences(): Promise<Preferences> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('user_preferences')
    .select('theme, color_mode')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return {
    theme: data.theme as Theme,
    mode: data.color_mode as Mode,
  };
}

export async function updatePreferences(
  patch: Partial<{ theme: Theme; mode: Mode }>,
): Promise<void> {
  const userId = await currentUserId();
  const dbPatch: Record<string, string> = {};
  if (patch.theme !== undefined) dbPatch.theme = patch.theme;
  if (patch.mode !== undefined) dbPatch.color_mode = patch.mode;
  if (Object.keys(dbPatch).length === 0) return;

  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, ...dbPatch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) throw error;
}
