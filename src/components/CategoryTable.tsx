import { useState } from 'react';
import LineItemRow from './LineItemRow';
import { addLineItem } from '../api/budget';
import { difference, differenceClass, formatMoney, sum } from '../utils/money';
import type { CategoryWithItems, LineItem } from '../types';

type Props = {
  category: CategoryWithItems;
  onCategoryChange: (next: CategoryWithItems) => void;
};

type Draft = { name: string; projected: number; actual: number };

export default function CategoryTable({ category, onCategoryChange }: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);

  const items = category.items;
  const subProjected = sum(items.map((i) => i.projected));
  const subActual = sum(items.map((i) => i.actual));
  const subDiff = difference(subActual, subProjected);

  function startDraft() {
    if (draft) return;
    setDraft({ name: '', projected: 0, actual: 0 });
  }

  async function commitDraft() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) { setDraft(null); return; }
    try {
      const created = await addLineItem(category.id, {
        name,
        projected: draft.projected,
        actual: draft.actual,
      });
      onCategoryChange({ ...category, items: [...items, created] });
      setDraft(null);
    } catch {
      setDraft(null);
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

  return (
    <section className="border rounded-lg p-4 bg-white space-y-2">
      <h2 className="text-xl font-medium">{category.name}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="font-normal py-1">Name</th>
            <th className="font-normal py-1 w-32">Projected</th>
            <th className="font-normal py-1 w-32">Actual</th>
            <th className="font-normal py-1 w-32 text-right pr-2">Difference</th>
            <th className="w-12"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <LineItemRow
              key={item.id}
              item={item}
              onChange={(next) => replaceItem(item.id, next)}
              onDelete={() => removeItem(item.id)}
            />
          ))}
          {draft && (
            <tr>
              <td>
                <input
                  autoFocus
                  type="text"
                  value={draft.name}
                  placeholder="Item name"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  onBlur={commitDraft}
                  className="w-full border rounded px-2 py-1"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  value={draft.projected}
                  onChange={(e) =>
                    setDraft({ ...draft, projected: Number(e.target.value) || 0 })
                  }
                  className="w-full border rounded px-2 py-1"
                />
              </td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  value={draft.actual}
                  onChange={(e) =>
                    setDraft({ ...draft, actual: Number(e.target.value) || 0 })
                  }
                  className="w-full border rounded px-2 py-1"
                />
              </td>
              <td></td>
              <td></td>
            </tr>
          )}
          <tr>
            <td colSpan={5} className="pt-2">
              <button
                type="button"
                onClick={startDraft}
                className="text-sm text-blue-600"
                disabled={!!draft}
              >
                + Add item
              </button>
            </td>
          </tr>
          <tr className="border-t font-medium">
            <td className="py-1">Subtotal</td>
            <td className="pl-2">{formatMoney(subProjected)}</td>
            <td className="pl-2">{formatMoney(subActual)}</td>
            <td className={`text-right pr-2 ${differenceClass('cost', subDiff)}`}>
              {formatMoney(subDiff)}
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
