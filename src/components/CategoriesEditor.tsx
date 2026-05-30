import { useCallback, useEffect, useState } from 'react';
import CategoryRow from './CategoryRow';
import {
  addCategory,
  moveAndDeleteCategory,
  reorderCategories,
} from '../api/categories';
import { supabase } from '../lib/supabase';
import type { Category } from '../types';

type DeleteDialogState =
  | { open: false }
  | { open: true; source: Category; itemCount: number };

export default function CategoriesEditor() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [dialog, setDialog] = useState<DeleteDialogState>({ open: false });
  const [dstChoice, setDstChoice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user?.user?.id;
      if (!uid) return;
      const { data, error: e } = await supabase
        .from('categories')
        .select('id, name, display_order, icon')
        .eq('user_id', uid)
        .order('display_order');
      if (cancelled) return;
      if (e) { setError(e.message); return; }
      setCategories((data ?? []) as Category[]);
    })();
    return () => { cancelled = true; };
  }, []);

  const replace = useCallback((next: Category) => {
    setCategories((cs) => cs.map((c) => (c.id === next.id ? next : c)));
  }, []);

  function onDragStart(id: number) {
    return (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', String(id));
      e.dataTransfer.effectAllowed = 'move';
    };
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  async function onDrop(targetId: number, e: React.DragEvent) {
    e.preventDefault();
    const srcId = Number(e.dataTransfer.getData('text/plain'));
    if (!srcId || srcId === targetId) return;
    const srcIdx = categories.findIndex((c) => c.id === srcId);
    const dstIdx = categories.findIndex((c) => c.id === targetId);
    if (srcIdx < 0 || dstIdx < 0) return;
    const next = [...categories];
    const [moved] = next.splice(srcIdx, 1);
    next.splice(dstIdx, 0, moved);
    const previous = categories;
    setCategories(next);
    try { await reorderCategories(next.map((c) => c.id)); }
    catch (err) { setCategories(previous); setError(err instanceof Error ? err.message : String(err)); }
  }

  async function commitDraft() {
    const trimmed = draftName.trim();
    setDrafting(false);
    setDraftName('');
    if (!trimmed) return;
    try {
      const created = await addCategory(trimmed, '📁');
      setCategories((cs) => [...cs, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function openDeleteFor(source: Category) {
    const { data: user } = await supabase.auth.getUser();
    const uid = user?.user?.id;
    if (!uid) return;
    const { data, error: e } = await supabase
      .from('line_items')
      .select('id')
      .eq('user_id', uid)
      .eq('category_id', source.id);
    if (e) { setError(e.message); return; }
    const itemCount = (data ?? []).length;
    setDialog({ open: true, source, itemCount });
    setDstChoice(null);
  }

  async function confirmDelete() {
    if (!dialog.open) return;
    const src = dialog.source;
    setDialog({ open: false });
    try {
      if (dialog.itemCount === 0) {
        await supabase.from('categories').delete().eq('id', src.id);
      } else {
        if (!dstChoice) return;
        await moveAndDeleteCategory(src.id, dstChoice);
      }
      setCategories((cs) => cs.filter((c) => c.id !== src.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="bg-card rounded-xl p-4">
      <div className="font-extrabold text-sm">Categories</div>
      <div className="text-muted text-xs mb-2">Drag to reorder. Click an emoji to change it.</div>
      {error && <div className="text-negative text-xs mb-2">{error}</div>}
      <div className="space-y-1.5">
        {categories.map((c) => (
          <div
            key={c.id}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(c.id, e)}
          >
            <div onDragStart={onDragStart(c.id)}>
              <CategoryRow
                category={c}
                onChange={replace}
                onDelete={openDeleteFor}
                dragHandleLabel={`Drag handle for ${c.name}`}
              />
            </div>
          </div>
        ))}
        {drafting && (
          <div className="grid items-center gap-2 bg-bg rounded-lg p-2"
               style={{ gridTemplateColumns: '24px 32px 1fr 28px' }}>
            <span />
            <span className="text-xl text-center">📁</span>
            <input
              autoFocus
              type="text"
              value={draftName}
              maxLength={80}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitDraft(); }
                if (e.key === 'Escape') { e.preventDefault(); setDrafting(false); setDraftName(''); }
              }}
              placeholder="New category name"
              className="w-full px-2 py-1 border border-highlight rounded-md bg-card text-sm"
            />
            <span />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setDrafting(true)}
        disabled={drafting}
        className="mt-2 w-full text-xs text-muted bg-bg rounded-lg px-2.5 py-1.5 disabled:opacity-50"
        style={{ border: '1px dashed var(--dashed)' }}
      >
        + Add category
      </button>

      {dialog.open && (
        <div
          role="dialog"
          aria-label={`Delete ${dialog.source.name}`}
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
          onClick={() => setDialog({ open: false })}
        >
          <div
            className="bg-card rounded-xl p-5 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-extrabold text-sm mb-2">Delete "{dialog.source.name}"?</div>
            {dialog.itemCount === 0 ? (
              <div className="text-muted text-xs mb-3">It has no items.</div>
            ) : (
              <>
                <div className="text-muted text-xs mb-2">
                  This category has {dialog.itemCount} items across all months.
                </div>
                <label className="block text-xs mb-3">
                  <span className="font-bold">Move to</span>
                  <select
                    aria-label="Move to"
                    value={dstChoice ?? ''}
                    onChange={(e) => setDstChoice(Number(e.target.value) || null)}
                    className="w-full mt-1 px-2 py-1 border border-highlight rounded-md bg-bg text-sm"
                  >
                    <option value="">Pick a category</option>
                    {categories
                      .filter((c) => c.id !== dialog.source.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </label>
              </>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialog({ open: false })}
                className="text-xs bg-bg rounded-md px-2.5 py-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={dialog.itemCount > 0 && !dstChoice}
                className="text-xs bg-negative text-white rounded-md px-2.5 py-1 disabled:opacity-50"
              >
                {dialog.itemCount === 0 ? 'Delete' : 'Move & delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
