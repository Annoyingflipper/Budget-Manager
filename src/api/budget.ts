import { supabase } from '../lib/supabase';
import type { Budget, LineItem } from '../types';

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

export async function getBudget(): Promise<Budget> {
  const userId = await currentUserId();

  const { data: income, error: incomeErr } = await supabase
    .from('income')
    .select('projected, actual')
    .eq('user_id', userId)
    .single();
  if (incomeErr) throw incomeErr;

  const { data: categories, error: catErr } = await supabase
    .from('categories')
    .select('id, name, display_order')
    .eq('user_id', userId)
    .order('display_order');
  if (catErr) throw catErr;

  const { data: items, error: itemsErr } = await supabase
    .from('line_items')
    .select('id, category_id, name, projected, actual')
    .eq('user_id', userId)
    .order('created_at');
  if (itemsErr) throw itemsErr;

  const byCategory = new Map<number, LineItem[]>();
  for (const raw of items ?? []) {
    const normalized: LineItem = {
      id: raw.id,
      category_id: raw.category_id,
      name: raw.name,
      projected: Number(raw.projected),
      actual: Number(raw.actual),
    };
    const list = byCategory.get(normalized.category_id) ?? [];
    list.push(normalized);
    byCategory.set(normalized.category_id, list);
  }

  return {
    income: {
      projected: Number(income.projected),
      actual: Number(income.actual),
    },
    categories: (categories ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      display_order: c.display_order,
      items: byCategory.get(c.id) ?? [],
    })),
  };
}

export async function updateIncome(
  patch: { projected?: number; actual?: number }
): Promise<void> {
  const userId = await currentUserId();
  // Upsert so a missing income row (e.g., a user whose seed trigger never
  // fired) self-heals instead of silently no-op'ing.
  const { error } = await supabase
    .from('income')
    .upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}

export async function addLineItem(
  categoryId: number,
  item: { name: string; projected: number; actual: number }
): Promise<LineItem> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('line_items')
    .insert({
      user_id: userId,
      category_id: categoryId,
      name: item.name,
      projected: item.projected,
      actual: item.actual,
    })
    .select('id, category_id, name, projected, actual')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    category_id: data.category_id,
    name: data.name,
    projected: Number(data.projected),
    actual: Number(data.actual),
  };
}

export async function updateLineItem(
  id: number,
  patch: Partial<{ name: string; projected: number; actual: number }>
): Promise<void> {
  const { error } = await supabase.from('line_items').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteLineItem(id: number): Promise<void> {
  const { error } = await supabase.from('line_items').delete().eq('id', id);
  if (error) throw error;
}
