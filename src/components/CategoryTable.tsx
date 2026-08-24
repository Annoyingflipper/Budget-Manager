import { useState } from 'react';
import LineItemRow from './LineItemRow';
import DraftRow from './DraftRow';
import EmptyCategoryCard from './EmptyCategoryCard';
import CategoryBudgetBar from './CategoryBudgetBar';
import { ROW_GRID } from './rowGrid';
import { addLineItem } from '../api/budget';
import { difference, differenceClass, formatMoney, sum } from '../utils/money';
import type { Currency } from '../utils/currency';
import type { RateRow } from '../utils/rates';
import type { Attachment } from '../types';
import type { CategoryWithItems, LineItem } from '../types';

type Props = {
  category: CategoryWithItems;
  periodMonth: string;
  onCategoryChange: (next: CategoryWithItems) => void;
  /** Currency untagged amounts are in, and that per-item conversions display in. */
  base?: Currency;
  /** Passed down so a row can recompute its converted amount after an edit. */
  rates?: RateRow[];
  attachments?: Attachment[];
  onAttachmentsChange?: () => void;
};

export default function CategoryTable({
  category, periodMonth, onCategoryChange, base = 'USD', rates = [],
  attachments = [], onAttachmentsChange,
}: Props) {
  const [drafting, setDrafting] = useState(false);
  const [confirmingItemId, setConfirmingItemId] = useState<number | null>(null);

  const items = category.items;
  const subProjected = sum(items.map((i) => i.baseProjected));
  const subActual = sum(items.map((i) => i.baseActual));
  const subDiff = difference(subActual, subProjected);

  async function commit(draft: { name: string; projected: number; actual: number }) {
    try {
      const created = await addLineItem(periodMonth, category.id, draft);
      onCategoryChange({ ...category, items: [...items, created] });
    } finally {
      setDrafting(false);
    }
  }

  function replaceItem(id: number, next: LineItem) {
    onCategoryChange({
      ...category,
      items: items.map((i) => (i.id === id ? next : i)),
    });
  }

  function removeItem(id: number) {
    onCategoryChange({ ...category, items: items.filter((i) => i.id !== id) });
  }

  if (items.length === 0 && !drafting) {
    return (
      <EmptyCategoryCard
        categoryName={category.name}
        categoryIcon={category.icon}
        onAddFirst={() => setDrafting(true)}
      />
    );
  }

  return (
    <section className="bg-card rounded-xl p-4 mb-3">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{category.icon}</span>
          <span className="font-extrabold text-sm">{category.name}</span>
        </div>
        <span className={`text-xs font-bold ${differenceClass('cost', subDiff)}`}>
          {subDiff === 0 ? 'on budget' : (subDiff > 0 ? `${formatMoney(subDiff)} over` : `${formatMoney(Math.abs(subDiff))} under`)}
        </span>
      </div>

      <CategoryBudgetBar
        categoryId={category.id}
        categoryName={category.name}
        projected={subProjected}
        actual={subActual}
      />

      <div
        className="hidden sm:grid gap-1.5 items-center mb-1"
        style={{ gridTemplateColumns: ROW_GRID }}
      >
        <div className="text-muted text-xs uppercase tracking-wider">Name</div>
        <div className="text-muted text-xs uppercase tracking-wider text-right">Proj</div>
        <div className="text-muted text-xs uppercase tracking-wider text-right">Actual</div>
        <div className="text-muted text-xs uppercase tracking-wider">Cur</div>
        <div className="text-muted text-xs uppercase tracking-wider text-right">Diff</div>
        <div className="text-muted text-xs uppercase tracking-wider">Paid</div>
        <div className="text-muted text-xs uppercase tracking-wider">Due</div>
        <div />
      </div>

      <div className="space-y-1.5">
        {items.map((item) => (
          <LineItemRow
            key={item.id}
            item={item}
            isConfirming={confirmingItemId === item.id}
            onConfirmRequest={() => setConfirmingItemId(item.id)}
            onChange={(next) => replaceItem(item.id, next)}
            onDelete={() => {
              setConfirmingItemId(null);
              removeItem(item.id);
            }}
            base={base}
            rates={rates}
            attachments={attachments.filter((a) => a.lineItemId === item.id)}
            onAttachmentsChange={onAttachmentsChange}
          />
        ))}
        {drafting && (
          <DraftRow
            onCommit={commit}
            onDiscard={() => setDrafting(false)}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setDrafting(true)}
        disabled={drafting}
        className="mt-2 w-full text-xs text-muted bg-bg rounded-lg px-2.5 py-1.5 disabled:opacity-50"
        style={{ border: '1px dashed var(--dashed)' }}
      >
        + Add item
      </button>

      <div
        className="mt-2 pt-1.5 flex justify-between text-xs"
        style={{ borderTop: '1px dashed var(--dashed)' }}
      >
        <span className="font-bold">Subtotal</span>
        <span data-testid={`subtotal-${category.id}`}>
          <span className="text-muted">{formatMoney(subProjected)} / {formatMoney(subActual)}</span>{' '}
          ·{' '}
          <span className={`font-bold ${differenceClass('cost', subDiff)}`}>{formatMoney(subDiff)}</span>
        </span>
      </div>
    </section>
  );
}
