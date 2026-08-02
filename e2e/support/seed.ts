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
  // v1.9 chunk 3: attachment rows first (FK to line_items), and their Storage
  // objects, or uploads accumulate across CI runs and fill the 1 GB quota.
  await clearReceipts(uid);
  await del('line_item_attachments', uid);
  await del('line_items', uid);
  await del('income', uid);
  await del('categories', uid);
  // v1.9: neither is referenced by a foreign key, so order is irrelevant — but
  // both must be wiped or accounts accumulate across runs against the shared
  // test user and every subtotal assertion becomes non-deterministic.
  await del('accounts', uid);
  await del('exchange_rates', uid);

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

  // 5. Reset theme prefs to defaults so the theme spec has a deterministic start
  //    (theme/mode persist in the DB and would otherwise carry across runs).
  const { error: prefErr } = await admin
    .from('user_preferences')
    .upsert(
      { user_id: uid, theme: 'peach', color_mode: 'light', base_currency: 'USD' },
      { onConflict: 'user_id' },
    );
  if (prefErr) throw new Error(`Failed to reset preferences: ${prefErr.message}`);

  return byName;
}

async function del(
  table: 'line_items' | 'income' | 'categories' | 'accounts' | 'exchange_rates'
    | 'line_item_attachments',
  uid: string,
): Promise<void> {
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

/**
 * Empties the test user's folder in the private `receipts` bucket.
 *
 * Lists Storage directly rather than reading line_item_attachments: an object
 * whose row has already been cascaded away has nothing pointing at it, and those
 * orphans are exactly what needs sweeping. Reading the rows would miss them.
 */
async function clearReceipts(uid: string): Promise<void> {
  const { data: itemFolders, error: listErr } = await admin.storage.from('receipts').list(uid);
  if (listErr) throw new Error(`Failed to list receipts: ${listErr.message}`);

  // In parallel: one round trip per item folder, and a backlog of orphans can be
  // dozens of folders — sequentially that alone outran the setup project's timeout.
  const perFolder = await Promise.all(
    (itemFolders ?? []).map(async (folder) => {
      const { data: files } = await admin.storage.from('receipts').list(`${uid}/${folder.name}`);
      return (files ?? []).map((file) => `${uid}/${folder.name}/${file.name}`);
    }),
  );
  const paths = perFolder.flat();
  if (paths.length === 0) return;

  const { error } = await admin.storage.from('receipts').remove(paths);
  if (error) throw new Error(`Failed to clear receipts: ${error.message}`);
}
