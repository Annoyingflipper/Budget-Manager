import { supabase } from '../lib/supabase';
import { getBaseCurrency } from './userPrefs';
import { listRates } from './rates';
import { convertAmount } from '../utils/itemMoney';
import { removeAttachmentsForItems } from './attachments';
import { todayISO } from '../utils/date';
import type { Currency } from '../utils/currency';
import type { Budget, Income, LineItem, ExportRow } from '../types';

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

function normalizeItem(
  raw: Record<string, unknown>,
  base: Currency,
  rates: Awaited<ReturnType<typeof listRates>>,
  today: string,
): LineItem {
  const item = {
    id: raw.id as number,
    category_id: raw.category_id as number,
    name: raw.name as string,
    projected: Number(raw.projected),
    actual: Number(raw.actual),
    paidOn: (raw.paid_on as string | null) ?? null,
    dueOn: (raw.due_on as string | null) ?? null,
    currency: (raw.currency as Currency | null) ?? null,
    rateUnitsPerUsd:
      raw.rate_units_per_usd === null || raw.rate_units_per_usd === undefined
        ? null
        : Number(raw.rate_units_per_usd),
  };

  const baseProjected = convertAmount(item.projected, item, base, rates, today);
  const baseActual = convertAmount(item.actual, item, base, rates, today);
  const rateResolved = baseProjected !== null && baseActual !== null;

  return {
    ...item,
    // Falling back to the native amount keeps the app usable; rateResolved is
    // what makes the shortfall visible rather than silently wrong.
    baseProjected: baseProjected ?? item.projected,
    baseActual: baseActual ?? item.actual,
    rateResolved,
  };
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
    .select('id, name, display_order, icon')
    .eq('user_id', userId)
    .order('display_order');
  if (catErr) throw catErr;

  const { data: items, error: itemsErr } = await supabase
    .from('line_items')
    .select('id, category_id, name, projected, actual, paid_on, due_on, currency, rate_units_per_usd')
    .eq('user_id', userId)
    .eq('period_month', periodMonth)
    .order('created_at');
  if (itemsErr) throw itemsErr;

  // Conversion happens once, here at the data boundary, so that every total in
  // the app can keep summing plain numbers instead of learning about currencies.
  const base = await getBaseCurrency();
  const rates = await listRates();
  const today = todayISO();

  const byCategory = new Map<number, LineItem[]>();
  for (const raw of items ?? []) {
    const normalized = normalizeItem(raw as Record<string, unknown>, base, rates, today);
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
      icon: c.icon,
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

export async function deleteMonth(targetMonth: string): Promise<void> {
  // delete_month is a Postgres function and Postgres cannot reach Storage, so
  // the objects for every expense in the month must be cleared from here first.
  const userId = await currentUserId();
  const { data: items, error: itemsErr } = await supabase
    .from('line_items')
    .select('id')
    .eq('user_id', userId)
    .eq('period_month', targetMonth);
  if (itemsErr) throw itemsErr;
  await removeAttachmentsForItems(
    ((items ?? []) as Array<Record<string, unknown>>).map((r) => r.id as number),
  );

  const { error } = await supabase.rpc('delete_month', { target_month: targetMonth });
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
  item: { name: string; projected: number; actual: number; dueOn?: string | null },
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
      due_on: item.dueOn ?? null,
    })
    .select('id, category_id, name, projected, actual, paid_on, due_on, currency, rate_units_per_usd')
    .single();
  if (error) throw error;
  const base = await getBaseCurrency();
  const rates = await listRates();
  return normalizeItem(data as Record<string, unknown>, base, rates, todayISO());
}

export async function updateLineItem(
  id: number,
  patch: Partial<{
    name: string;
    projected: number;
    actual: number;
    paidOn: string | null;
    dueOn: string | null;
    currency: Currency | null;
    rateUnitsPerUsd: number | null;
  }>,
): Promise<void> {
  const { paidOn, dueOn, currency, rateUnitsPerUsd, ...rest } = patch;
  const dbPatch: Record<string, unknown> = { ...rest };
  // Presence-checked, so an explicit null clears the column instead of being
  // dropped as undefined.
  if ('paidOn' in patch) dbPatch.paid_on = paidOn;
  if ('dueOn' in patch) dbPatch.due_on = dueOn;
  if ('currency' in patch) dbPatch.currency = currency;
  if ('rateUnitsPerUsd' in patch) dbPatch.rate_units_per_usd = rateUnitsPerUsd;
  const { error } = await supabase.from('line_items').update(dbPatch).eq('id', id);
  if (error) throw error;
}

export async function deleteLineItem(id: number): Promise<void> {
  // Storage first: the FK cascade removes attachment rows but cannot reach
  // Storage, so deleting the item first would strand its files invisibly.
  await removeAttachmentsForItems([id]);
  const { error } = await supabase.from('line_items').delete().eq('id', id);
  if (error) throw error;
}

export async function getExportRows(): Promise<ExportRow[]> {
  const userId = await currentUserId();

  const { data: cats, error: catErr } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', userId);
  if (catErr) throw catErr;
  const nameById = new Map<number, string>(
    (cats ?? []).map((c) => [c.id as number, c.name as string]),
  );

  const { data: items, error: itemErr } = await supabase
    .from('line_items')
    .select('period_month, category_id, name, projected, actual, paid_on, currency, rate_units_per_usd')
    .eq('user_id', userId)
    .order('period_month');
  if (itemErr) throw itemErr;

  const base = await getBaseCurrency();
  const rates = await listRates();
  const today = todayISO();

  return (items ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const projected = Number(r.projected);
    const actual = Number(r.actual);
    const convertible = {
      currency: (r.currency as Currency | null) ?? null,
      paidOn: (r.paid_on as string | null) ?? null,
      rateUnitsPerUsd:
        r.rate_units_per_usd === null || r.rate_units_per_usd === undefined
          ? null
          : Number(r.rate_units_per_usd),
    };
    return {
      month: r.period_month as string,
      category: nameById.get(r.category_id as number) ?? 'Uncategorized',
      item: r.name as string,
      projected,
      actual,
      currency: convertible.currency ?? '',
      baseProjected: convertAmount(projected, convertible, base, rates, today) ?? projected,
      baseActual: convertAmount(actual, convertible, base, rates, today) ?? actual,
    };
  });
}
