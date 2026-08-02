import { useState } from 'react';
import { getExportRows } from '../api/budget';
import { budgetToExportRows } from '../utils/insights';
import { toCsv, downloadCsv } from '../utils/csv';
import type { Currency } from '../utils/currency';
import type { Budget, ExportRow } from '../types';

/**
  * The last two columns name the actual base currency rather than saying "base",
  * so the file explains itself when opened in a spreadsheet months later.
  */
function headers(base: Currency): string[] {
  return [
    'Month', 'Category', 'Item', 'Currency',
    'Projected', 'Actual', `Projected (${base})`, `Actual (${base})`,
  ];
}

function toMatrix(rows: ExportRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.month, r.category, r.item, r.currency,
    r.projected.toFixed(2), r.actual.toFixed(2),
    r.baseProjected.toFixed(2), r.baseActual.toFixed(2),
  ]);
}

type Props = { month: string; budget: Budget; base?: Currency };

export default function ExportButtons({ month, budget, base = 'USD' }: Props) {
  const [busy, setBusy] = useState(false);

  const exportThisMonth = () => {
    const rows = budgetToExportRows(month, budget);
    downloadCsv(`budget-${month.slice(0, 7)}.csv`, toCsv(headers(base), toMatrix(rows)));
  };

  const exportAll = async () => {
    setBusy(true);
    try {
      const rows = await getExportRows();
      downloadCsv('budget-all-history.csv', toCsv(headers(base), toMatrix(rows)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={exportThisMonth}
        className="bg-card border-0 rounded-lg px-3 py-2 text-sm font-bold"
      >
        ⤓ Export this month
      </button>
      <button
        type="button"
        onClick={exportAll}
        disabled={busy}
        className="bg-card border-0 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50"
      >
        {busy ? 'Exporting…' : '⤓ Export all history'}
      </button>
    </div>
  );
}
