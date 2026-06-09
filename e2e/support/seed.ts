import { admin, getTestUserId } from './supabaseAdmin';
import { env } from './env';
import {
  DEFAULT_CATEGORIES,
  INCOME,
  ITEMS_CURRENT,
  ITEMS_PRIOR,
  MONTH_CURRENT,
  MONTH_PRIOR,
  type SeedItem,
} from '../data/baseline';

export type CategoryIdMap = Map<string, number>;

/** Reset the test user to the canonical baseline. Safe to call repeatedly. */
export async function reseedTestUser(): Promise<CategoryIdMap> {
  const uid = await getTestUserId(env.E2E_USER_EMAIL);

  // 1. Wipe (line_items first — FK ON DELETE RESTRICT from categories).
  await del('line_items', uid);
  await del('income', uid);
  await del('categories', uid);

  // 2. Re-create the 8 default categories.
  const { data: cats, error: catErr } = await admin
    .from('categories')
    .insert(DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: uid })))
    .select('id, name');
  if (catErr) throw catErr;
  const byName: CategoryIdMap = new Map((cats ?? []).map((c) => [c.name as string, c.id as number]));

  // 3. Income for both months.
  await admin.from('income').insert([
    { user_id: uid, period_month: MONTH_CURRENT, ...INCOME[MONTH_CURRENT] },
    { user_id: uid, period_month: MONTH_PRIOR, ...INCOME[MONTH_PRIOR] },
  ]);

  // 4. Line items for both months.
  await insertItems(uid, MONTH_CURRENT, ITEMS_CURRENT, byName);
  await insertItems(uid, MONTH_PRIOR, ITEMS_PRIOR, byName);

  return byName;
}

async function del(table: 'line_items' | 'income' | 'categories', uid: string): Promise<void> {
  const { error } = await admin.from(table).delete().eq('user_id', uid);
  if (error) throw new Error(`Failed to clear ${table}: ${error.message}`);
}

async function insertItems(
  uid: string,
  periodMonth: string,
  items: SeedItem[],
  byName: CategoryIdMap,
): Promise<void> {
  const rows = items.map((i) => {
    const categoryId = byName.get(i.category);
    if (categoryId == null) throw new Error(`Unknown baseline category: ${i.category}`);
    return {
      user_id: uid,
      category_id: categoryId,
      name: i.name,
      projected: i.projected,
      actual: i.actual,
      period_month: periodMonth,
    };
  });
  const { error } = await admin.from('line_items').insert(rows);
  if (error) throw error;
}

/** Resolve a baseline category id by name (for read-only spec assertions). */
export async function categoryIdByName(name: string): Promise<number> {
  const uid = await getTestUserId(env.E2E_USER_EMAIL);
  const { data, error } = await admin
    .from('categories')
    .select('id')
    .eq('user_id', uid)
    .eq('name', name)
    .single();
  if (error) throw error;
  return data.id as number;
}
