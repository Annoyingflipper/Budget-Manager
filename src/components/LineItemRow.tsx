import { useEffect, useState } from 'react';
import { deleteLineItem, updateLineItem } from '../api/budget';
import { difference, differenceClass, formatMoney } from '../utils/money';
import type { LineItem } from '../types';

type Props = {
  item: LineItem;
  onChange: (next: LineItem) => void;
  onDelete: () => void;
};

export default function LineItemRow({ item, onChange, onDelete }: Props) {
  const [name, setName] = useState(item.name);
  const [projected, setProjected] = useState(String(item.projected));
  const [actual, setActual] = useState(String(item.actual));
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => setName(item.name), [item.name]);
  useEffect(() => setProjected(String(item.projected)), [item.projected]);
  useEffect(() => setActual(String(item.actual)), [item.actual]);

  const diff = difference(Number(actual) || 0, Number(projected) || 0);

  async function saveName() {
    const next = name.trim();
    if (!next) { setName(item.name); return; }
    if (next === item.name) return;
    const previous = item;
    onChange({ ...item, name: next });
    try {
      await updateLineItem(item.id, { name: next });
    } catch {
      onChange(previous);
    }
  }

  async function saveProjected() {
    const value = Number(projected) || 0;
    if (value === item.projected) return;
    const previous = item;
    onChange({ ...item, projected: value });
    try {
      await updateLineItem(item.id, { projected: value });
    } catch {
      onChange(previous);
    }
  }

  async function saveActual() {
    const value = Number(actual) || 0;
    if (value === item.actual) return;
    const previous = item;
    onChange({ ...item, actual: value });
    try {
      await updateLineItem(item.id, { actual: value });
    } catch {
      onChange(previous);
    }
  }

  async function handleDelete() {
    onDelete();
    try {
      await deleteLineItem(item.id);
    } catch {
      // Best-effort: the next page load will reconcile.
    }
  }

  return (
    <tr>
      <td>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          className="w-full border rounded px-2 py-1"
        />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          value={projected}
          onChange={(e) => setProjected(e.target.value)}
          onBlur={saveProjected}
          className="w-full border rounded px-2 py-1"
        />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          onBlur={saveActual}
          className="w-full border rounded px-2 py-1"
        />
      </td>
      <td className={`text-right pr-2 ${differenceClass('cost', diff)}`}>
        {formatMoney(diff)}
      </td>
      <td className="text-center">
        {confirmDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Confirm delete"
            className="text-red-600 text-xs"
          >
            Confirm
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete row"
            className="text-gray-400 hover:text-red-600"
          >
            ✕
          </button>
        )}
      </td>
    </tr>
  );
}
