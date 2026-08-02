import { useEffect, useState } from 'react';
import { deleteLineItem, updateLineItem } from '../api/budget';
import { difference, differenceClass } from '../utils/money';
import { useIsMobile } from '../hooks/useIsMobile';
import { todayISO } from '../utils/date';
import { CURRENCY_CODES, formatCurrency, type Currency } from '../utils/currency';
import { convertAmount } from '../utils/itemMoney';
import type { RateRow } from '../utils/rates';
import type { LineItem } from '../types';

type Props = {
  item: LineItem;
  isConfirming: boolean;
  onConfirmRequest: () => void;
  onChange: (next: LineItem) => void;
  onDelete: () => void;
  /** The currency untagged amounts are in, and that conversions are shown in. */
  base?: Currency;
  /** Needed to recompute the converted amount locally after an edit. */
  rates?: RateRow[];
};

export default function LineItemRow({
  item,
  isConfirming,
  onConfirmRequest,
  onChange,
  onDelete,
  base = 'USD',
  rates = [],
}: Props) {
  const isMobile = useIsMobile();
  const [name, setName] = useState(item.name);
  const [projected, setProjected] = useState(String(item.projected));
  const [actual, setActual] = useState(String(item.actual));
  const [paidDateDraft, setPaidDateDraft] = useState(item.paidOn ?? '');
  const [rateDraft, setRateDraft] = useState(
    item.rateUnitsPerUsd === null ? '' : String(item.rateUnitsPerUsd),
  );

  useEffect(() => setName(item.name), [item.name]);
  useEffect(() => setProjected(String(item.projected)), [item.projected]);
  useEffect(() => setActual(String(item.actual)), [item.actual]);
  useEffect(() => setPaidDateDraft(item.paidOn ?? ''), [item.paidOn]);
  useEffect(
    () => setRateDraft(item.rateUnitsPerUsd === null ? '' : String(item.rateUnitsPerUsd)),
    [item.rateUnitsPerUsd],
  );

  const diff = difference(Number(actual) || 0, Number(projected) || 0);
  const diffClass = differenceClass('cost', diff);
  // The row shows the amount the user actually typed, in the currency they typed
  // it in. The converted figure sits alongside it.
  const nativeCurrency: Currency = item.currency ?? base;
  const showConverted = item.currency !== null && item.currency !== base;

  /**
   * `baseProjected`/`baseActual`/`rateResolved` are computed server-side in
   * getBudget. Any local edit that changes the amount, the currency or the rate
   * has to recompute them too, or the row and every total would keep showing the
   * pre-edit conversion until the next reload.
   */
  function withConversion(next: LineItem): LineItem {
    const today = todayISO();
    const bp = convertAmount(next.projected, next, base, rates, today);
    const ba = convertAmount(next.actual, next, base, rates, today);
    return {
      ...next,
      baseProjected: bp ?? next.projected,
      baseActual: ba ?? next.actual,
      rateResolved: bp !== null && ba !== null,
    };
  }

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
    onChange(withConversion({ ...item, projected: value }));
    try { await updateLineItem(item.id, { projected: value }); }
    catch { onChange(previous); }
  }

  async function saveActual() {
    const value = Number(actual) || 0;
    if (value === item.actual) return;
    const previous = item;
    onChange(withConversion({ ...item, actual: value }));
    try { await updateLineItem(item.id, { actual: value }); }
    catch { onChange(previous); }
  }

  async function savePaidOn(next: string | null) {
    if (next === item.paidOn) return;
    const previous = item;
    onChange(withConversion({ ...item, paidOn: next }));
    try { await updateLineItem(item.id, { paidOn: next }); }
    catch { onChange(previous); }
  }

  async function saveCurrency(next: Currency | null) {
    if (next === item.currency) return;
    const previous = item;
    onChange(withConversion({ ...item, currency: next }));
    try { await updateLineItem(item.id, { currency: next }); }
    catch { onChange(previous); }
  }

  async function saveRateOverride() {
    const trimmed = rateDraft.trim();
    const next = trimmed === '' ? null : Number(trimmed);
    // A zero or negative rate is not a rate; refuse it rather than storing nonsense.
    if (next !== null && (Number.isNaN(next) || next <= 0)) {
      setRateDraft(item.rateUnitsPerUsd === null ? '' : String(item.rateUnitsPerUsd));
      return;
    }
    if (next === item.rateUnitsPerUsd) return;
    const previous = item;
    onChange(withConversion({ ...item, rateUnitsPerUsd: next }));
    try { await updateLineItem(item.id, { rateUnitsPerUsd: next }); }
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

  const currencySelect = (
    <select
      value={item.currency ?? ''}
      onChange={(e) => saveCurrency((e.target.value || null) as Currency | null)}
      aria-label="Currency"
      title="Currency for this expense"
      className="w-full min-w-0 px-1 py-1 border border-highlight rounded-md bg-card text-xs"
    >
      <option value="">—</option>
      {CURRENCY_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
    </select>
  );

  const currencyStrip = item.currency === null ? null : (
    <div className="flex items-center gap-2 flex-wrap text-xs text-muted pl-1 pb-1">
      {showConverted && (
        <span data-testid={`converted-${item.id}`}>
          ≈ <span className="font-bold text-text">{formatCurrency(item.baseProjected, base)}</span>
          {item.baseActual !== item.baseProjected && (
            <> · actual {formatCurrency(item.baseActual, base)}</>
          )}
        </span>
      )}
      <label className="flex items-center gap-1">
        <span>rate</span>
        <input
          type="number"
          step="0.000001"
          value={rateDraft}
          onChange={(e) => setRateDraft(e.target.value)}
          onBlur={saveRateOverride}
          placeholder="official"
          aria-label="Rate override"
          title={`${item.currency} per 1 USD — leave blank to use the official rate`}
          className="w-24 px-1 py-0.5 border border-highlight rounded bg-card text-xs"
        />
      </label>
      {item.rateUnitsPerUsd !== null && (
        <span data-testid={`rate-overridden-${item.id}`} title="Using your own rate, not the official one">
          ✎ custom rate
        </span>
      )}
      {!item.rateResolved && (
        <span
          data-testid={`rate-unresolved-${item.id}`}
          className="text-warning font-bold"
          title="No rate is known for this date, so this expense is counted at face value"
        >
          ⚠ no rate for this date
        </span>
      )}
    </div>
  );

  const paidControl = item.paidOn ? (
    <div className="flex items-center gap-1 min-w-0">
      <button
        type="button"
        onClick={() => savePaidOn(null)}
        aria-label="Mark unpaid"
        title="Mark unpaid"
        className="shrink-0 text-positive hover:text-negative text-sm"
      >
        ✓
      </button>
      <input
        type="date"
        aria-label="Paid date"
        value={paidDateDraft}
        onChange={(e) => setPaidDateDraft(e.target.value)}
        onBlur={() => savePaidOn(paidDateDraft || null)}
        className="w-full min-w-0 px-1 py-1 border border-highlight rounded-md bg-card text-xs"
      />
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
              {formatCurrency(diff, nativeCurrency)}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted mb-0.5">Paid</div>
            {paidControl}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted mb-0.5">Currency</div>
            {currencySelect}
          </div>
        </div>
        {currencyStrip}
      </div>
    );
  }

  return (
    <div data-testid={`line-item-${item.id}`}>
      <div
        className="grid items-center gap-1.5"
        style={{ gridTemplateColumns: '1.4fr 76px 76px 58px 76px 138px 24px' }}
      >
        {nameInput}
        {projectedInput}
        {actualInput}
        {currencySelect}
        <div className={`text-right pr-1 text-sm font-bold ${diffClass}`}>
          {formatCurrency(diff, nativeCurrency)}
        </div>
        {paidControl}
        <div className="text-center">{deleteButton}</div>
      </div>
      {currencyStrip}
    </div>
  );
}
