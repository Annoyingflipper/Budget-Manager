import { useState } from 'react';
import type { RateRow, RateSource } from '../utils/rates';

type Foreign = 'EUR' | 'VES';

const FOREIGN: Foreign[] = ['EUR', 'VES'];

const SOURCE_LABEL: Record<RateSource, string> = {
  ecb: 'ECB',
  bcv: 'BCV',
  manual: 'Manual',
};

type Props = {
  rates: RateRow[];
  date: string;
  onSaveRate: (currency: Foreign, date: string, unitsPerUsd: number) => void;
  onRefresh: () => void;
  refreshing: boolean;
  /** Pulls the full ECB series for EUR — the one currency with real history available. */
  onBackfillEur: () => void;
  backfilling: boolean;
  /** Days imported by the last backfill, or null if none has run this session. */
  backfillResult: number | null;
};

/**
 * The winning row for a currency on `date` — the same carry-forward rule as
 * rateFor(), but returning the whole row so its source and date can be shown.
 */
function effectiveRow(rates: RateRow[], currency: Foreign, date: string): RateRow | null {
  const candidates = rates.filter((r) => r.currency === currency && r.rateDate <= date);
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (a.rateDate > b.rateDate ? a : b));
}

export default function ExchangeRatesPanel({
  rates, date, onSaveRate, onRefresh, refreshing, onBackfillEur, backfilling, backfillResult,
}: Props) {
  const [currency, setCurrency] = useState<Foreign>('EUR');
  const [manualDate, setManualDate] = useState('');
  const [value, setValue] = useState('');

  function save() {
    const parsed = Number(value);
    if (!manualDate || !value.trim() || Number.isNaN(parsed) || parsed <= 0) return;
    onSaveRate(currency, manualDate, parsed);
    setValue('');
    setManualDate('');
  }

  return (
    <section className="bg-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="font-extrabold text-sm">Exchange rates</div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Refresh rates"
          className="text-xs text-muted bg-bg rounded-md px-2 py-1 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {FOREIGN.map((code) => {
        const row = effectiveRow(rates, code, date);
        return (
          <div key={code} data-testid={`rate-${code}`} className="flex justify-between text-xs py-0.5">
            <span className="text-muted">1 USD =</span>
            {row ? (
              <span>
                <span className="font-bold">{row.unitsPerUsd}</span> {code}
                <span className="text-muted"> · {SOURCE_LABEL[row.source]} · {row.rateDate}</span>
              </span>
            ) : (
              <span className="text-muted">{code} — not set</span>
            )}
          </div>
        );
      })}

      <div className="border-t border-highlight mt-3 pt-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-muted text-xs">
            Import the full euro history from the ECB
          </div>
          <button
            type="button"
            onClick={onBackfillEur}
            disabled={backfilling}
            // Stable accessible name: the visible label changes while running,
            // and the control should not lose its identity mid-action.
            aria-label="Backfill euro history"
            className="shrink-0 text-xs bg-bg rounded-md px-2 py-1 disabled:opacity-50"
          >
            {backfilling ? 'Importing…' : 'Backfill euro history'}
          </button>
        </div>
        {backfillResult !== null && (
          <div data-testid="backfill-result" className="text-muted text-xs mb-2">
            {backfillResult === 0
              ? 'Already up to date — no new days to import.'
              : `Imported ${backfillResult} days of euro rates.`}
          </div>
        )}
        <div className="text-muted text-xs mb-1">
          Add or correct a rate for a past date (bolívar history has to be entered by hand)
        </div>
        <div className="flex gap-2">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Foreign)}
            aria-label="Manual rate currency"
            className="px-1 py-1 border border-highlight rounded-md bg-bg text-xs"
          >
            {FOREIGN.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
          <input
            type="date"
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
            aria-label="Manual rate date"
            className="px-1 py-1 border border-highlight rounded-md bg-bg text-xs"
          />
          <input
            type="number"
            step="0.000001"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="per USD"
            aria-label="Manual rate value"
            className="w-24 px-1 py-1 border border-highlight rounded-md bg-bg text-xs"
          />
          <button
            type="button"
            onClick={save}
            aria-label="Save rate"
            className="text-xs bg-bg rounded-md px-2 py-1"
          >
            Save
          </button>
        </div>
      </div>
    </section>
  );
}
