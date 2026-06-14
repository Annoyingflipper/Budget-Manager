import { useEffect, useState } from 'react';
import { deleteLineItem, updateLineItem } from '../api/budget';
import { difference, differenceClass, formatMoney } from '../utils/money';
import { useIsMobile } from '../hooks/useIsMobile';
import { todayISO } from '../utils/date';
import type { LineItem } from '../types';

type Props = {
  item: LineItem;
  isConfirming: boolean;
  onConfirmRequest: () => void;
  onChange: (next: LineItem) => void;
  onDelete: () => void;
};

export default function LineItemRow({
  item,
  isConfirming,
  onConfirmRequest,
  onChange,
  onDelete,
}: Props) {
  const isMobile = useIsMobile();
  const [name, setName] = useState(item.name);
  const [projected, setProjected] = useState(String(item.projected));
  const [actual, setActual] = useState(String(item.actual));
  const [paidDateDraft, setPaidDateDraft] = useState(item.paidOn ?? '');

  useEffect(() => setName(item.name), [item.name]);
  useEffect(() => setProjected(String(item.projected)), [item.projected]);
  useEffect(() => setActual(String(item.actual)), [item.actual]);
  useEffect(() => setPaidDateDraft(item.paidOn ?? ''), [item.paidOn]);

  const diff = difference(Number(actual) || 0, Number(projected) || 0);
  const diffClass = differenceClass('cost', diff);

  async function saveName() {
    const next = name.trim();
    if (!next) { setName(item.name); return; }
    if (next === item.name) return;
    const previous = item;
    onChange({ ...item, name: next });
    try { await updateLineItem(item.id, { name: next }); }
    catch { onChange(previous); }
  }

  async function saveProjected() {
    const value = Number(projected) || 0;
    if (value === item.projected) return;
    const previous = item;
    onChange({ ...item, projected: value });
    try { await updateLineItem(item.id, { projected: value }); }
    catch { onChange(previous); }
  }

  async function saveActual() {
    const value = Number(actual) || 0;
    if (value === item.actual) return;
    const previous = item;
    onChange({ ...item, actual: value });
    try { await updateLineItem(item.id, { actual: value }); }
    catch { onChange(previous); }
  }

  async function savePaidOn(next: string | null) {
    if (next === item.paidOn) return;
    const previous = item;
    onChange({ ...item, paidOn: next });
    try { await updateLineItem(item.id, { paidOn: next }); }
    catch { onChange(previous); }
  }

  async function handleDelete() {
    onDelete();
    try { await deleteLineItem(item.id); }
    catch { /* Best-effort */ }
  }

  const deleteButton = isConfirming ? (
    <button
      type="button"
      onClick={handleDelete}
      aria-label="Confirm delete"
      className="text-negative text-base"
    >
      ✓
    </button>
  ) : (
    <button
      type="button"
      onClick={onConfirmRequest}
      aria-label="Delete row"
      className="text-muted hover:text-negative"
    >
      ✕
    </button>
  );

  const nameInput = (
    <input
      type="text"
      value={name}
      maxLength={80}
      onChange={(e) => setName(e.target.value)}
      onBlur={saveName}
      className="w-full min-w-0 px-2 py-1 border border-highlight rounded-md bg-card text-sm"
    />
  );

  const projectedInput = (
    <input
      type="number"
      step="0.01"
      value={projected}
      onChange={(e) => setProjected(e.target.value)}
      onBlur={saveProjected}
      className="w-full min-w-0 px-2 py-1 border border-highlight rounded-md bg-card text-sm text-right"
    />
  );

  const actualInput = (
    <input
      type="number"
      step="0.01"
      value={actual}
      onChange={(e) => setActual(e.target.value)}
      onBlur={saveActual}
      className="w-full min-w-0 px-2 py-1 border border-highlight rounded-md bg-card text-sm text-right"
    />
  );

  const paidControl = item.paidOn ? (
    <div className="flex items-center gap-1 min-w-0">
      <span className="text-positive text-sm shrink-0" aria-hidden="true">✓</span>
      <input
        type="date"
        aria-label="Paid date"
        value={paidDateDraft}
        onChange={(e) => setPaidDateDraft(e.target.value)}
        onBlur={() => savePaidOn(paidDateDraft || null)}
        className="w-full min-w-0 px-1 py-1 border border-highlight rounded-md bg-card text-xs"
      />
      <button
        type="button"
        onClick={() => savePaidOn(null)}
        aria-label="Clear paid date"
        className="shrink-0 text-muted hover:text-negative text-sm"
      >
        ✕
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => savePaidOn(todayISO())}
      aria-label="Mark paid"
      className="w-full px-2 py-1 border border-highlight rounded-md bg-bg text-muted text-xs hover:text-positive"
    >
      Mark paid
    </button>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2 p-2 bg-bg rounded-lg">
        <div className="flex items-center gap-2">
          {nameInput}
          <div className="shrink-0">{deleteButton}</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted mb-0.5">Projected</div>
            {projectedInput}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted mb-0.5">Actual</div>
            {actualInput}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted mb-0.5">Diff</div>
            <div className={`px-2 py-1 text-right text-sm font-bold ${diffClass}`}>
              {formatMoney(diff)}
            </div>
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-muted mb-0.5">Paid</div>
          {paidControl}
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid items-center gap-1.5"
      style={{ gridTemplateColumns: '1.4fr 80px 80px 80px 110px 24px' }}
      data-testid={`line-item-${item.id}`}
    >
      {nameInput}
      {projectedInput}
      {actualInput}
      <div className={`text-right pr-1 text-sm font-bold ${diffClass}`}>
        {formatMoney(diff)}
      </div>
      {paidControl}
      <div className="text-center">{deleteButton}</div>
    </div>
  );
}
