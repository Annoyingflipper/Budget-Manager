import { supabase } from '../lib/supabase';
import type { Budget, Income, LineItem } from '../types';

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

export async function getBudget(periodMonth: string): Promise<Budget> {
  const userId = await currentUserId();

  const { data: income, error: incomeErr } = await supabase
    .from('income')
    .select('projected, actual')
    .eq('user_id', userId)
    .eq('period_month', periodMonth)
    .maybeSingle();
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
    .eq('period_month', periodMonth)
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
      projected: Number(income?.projected ?? 0),
      actual: Number(income?.actual ?? 0),
    },
    categories: (categories ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      display_order: c.display_order,
      items: byCategory.get(c.id) ?? [],
    })),
  };
}

export async function listMonths(): Promise<string[]> {
  const userId = await currentUserId();
  const { data: incomeRows, error: e1 } = await supabase
    .from('income')
    .select('period_month')
    .eq('user_id', userId)
    .order('period_month', { ascending: false });
  if (e1) throw e1;
  const { data: itemRows, error: e2 } = await supabase
    .from('line_items')
    .select('period_month')
    .eq('user_id', userId)
    .order('period_month', { ascending: false });
  if (e2) throw e2;
  const set = new Set<string>();
  for (const r of incomeRows ?? []) set.add(r.period_month as string);
  for (const r of itemRows ?? []) set.add(r.period_month as string);
  return Array.from(set).sort().reverse();
}

export async function rolloverMonth(fromMonth: string, toMonth: string): Promise<void> {
  const { error } = await supabase.rpc('rollover_month', {
    from_month: fromMonth,
    to_month: toMonth,
  });
  if (error) throw error;
}

export async function updateIncome(
  periodMonth: string,
  patch: Partial<Income>,
): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from('income')
    .upsert(
      {
        user_id: userId,
        period_month: periodMonth,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,period_month' },
    );
  if (error) throw error;
}

export async function addLineItem(
  periodMonth: string,
  categoryId: number,
  item: { name: string; projected: number; actual: number },
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
      period_month: periodMonth,
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
  patch: Partial<{ name: string; projected: number; actual: number }>,
): Promise<void> {
  const { error } = await supabase.from('line_items').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteLineItem(id: number): Promise<void> {
  const { error } = await supabase.from('line_items').delete().eq('id', id);
  if (error) throw error;
}
