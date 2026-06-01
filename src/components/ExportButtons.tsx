import { useState } from 'react';
import { getExportRows } from '../api/budget';
import { budgetToExportRows } from '../utils/insights';
import { toCsv, downloadCsv } from '../utils/csv';
import type { Budget, ExportRow } from '../types';

const HEADERS = ['Month', 'Category', 'Item', 'Projected', 'Actual'];

function toMatrix(rows: ExportRow[]): (string | number)[][] {
  return rows.map((r) => [r.month, r.category, r.item, r.projected.toFixed(2), r.actual.toFixed(2)]);
}

type Props = { month: string; budget: Budget };

export default function ExportButtons({ month, budget }: Props) {
  const [busy, setBusy] = useState(false);

  const exportThisMonth = () => {
    const rows = budgetToExportRows(month, budget);
    downloadCsv(`budget-${month.slice(0, 7)}.csv`, toCsv(HEADERS, toMatrix(rows)));
  };

  const exportAll = async () => {
    setBusy(true);
    try {
      const rows = await getExportRows();
      downloadCsv('budget-all-history.csv', toCsv(HEADERS, toMatrix(rows)));
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
