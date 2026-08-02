import { supabase } from '../lib/supabase';
import type { Currency } from '../utils/currency';
import type { Account } from '../types';

const COLUMNS = 'id, name, icon, currency, balance, display_order';

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

function normalize(raw: Record<string, unknown>): Account {
  return {
    id: raw.id as number,
    name: raw.name as string,
    icon: raw.icon as string,
    currency: raw.currency as Currency,
    // PostgREST returns numeric columns as strings.
    balance: Number(raw.balance),
    display_order: raw.display_order as number,
  };
}

export async function listAccounts(): Promise<Account[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('accounts')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('display_order');
  if (error) throw error;
  return (data ?? []).map((r) => normalize(r as Record<string, unknown>));
}

export async function addAccount(input: {
  name: string;
  icon: string;
  currency: Currency;
  balance: number;
}): Promise<Account> {
  const userId = await currentUserId();
  const existing = await listAccounts();
  const nextOrder = existing.reduce((max, a) => Math.max(max, a.display_order), 0) + 1;

  const { data, error } = await supabase
    .from('accounts')
    .insert({ user_id: userId, display_order: nextOrder, ...input })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return normalize(data as Record<string, unknown>);
}

export async function updateAccount(
  id: number,
  patch: Partial<{ name: string; icon: string; currency: Currency; balance: number }>,
): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteAccount(id: number): Promise<void> {
  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) throw error;
}
