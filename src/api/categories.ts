import { supabase } from '../lib/supabase';
import type { Category } from '../types';

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

export async function addCategory(name: string, icon: string): Promise<Category> {
  const userId = await currentUserId();

  const { data: existing, error: maxErr } = await supabase
    .from('categories')
    .select('display_order')
    .eq('user_id', userId)
    .order('display_order', { ascending: false });
  if (maxErr) throw maxErr;
  const nextOrder = (existing?.[0]?.display_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, name, icon, display_order: nextOrder })
    .select('id, name, display_order, icon')
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    display_order: data.display_order,
    icon: data.icon,
  };
}

export async function renameCategory(id: number, name: string): Promise<void> {
  const { error } = await supabase.from('categories').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function setCategoryIcon(id: number, icon: string): Promise<void> {
  const { error } = await supabase.from('categories').update({ icon }).eq('id', id);
  if (error) throw error;
}

export async function moveAndDeleteCategory(srcId: number, dstId: number): Promise<void> {
  const { error } = await supabase.rpc('move_and_delete_category', {
    src_id: srcId,
    dst_id: dstId,
  });
  if (error) throw error;
}

export async function reorderCategories(orderedIds: number[]): Promise<void> {
  const { error } = await supabase.rpc('reorder_categories', { ordered_ids: orderedIds });
  if (error) throw error;
}
