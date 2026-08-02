import { useCallback, useEffect, useState } from 'react';
import AccountRow from '../components/AccountRow';
import TotalAvailable from '../components/TotalAvailable';
import ExchangeRatesPanel from '../components/ExchangeRatesPanel';
import { listAccounts, addAccount, updateAccount, deleteAccount } from '../api/accounts';
import { listMonths } from '../api/budget';
import { listRates, upsertRate, ensureTodayRates, fetchEcbRange } from '../api/rates';
import { todayISO } from '../utils/date';
import type { Currency } from '../utils/currency';
import type { RateRow } from '../utils/rates';
import type { Account } from '../types';

type Props = { onBack: () => void; base: Currency };

export default function Accounts({ onBack, base }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rates, setRates] = useState<RateRow[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayISO();

  const fail = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [loadedAccounts, loadedRates] = await Promise.all([listAccounts(), listRates()]);
        if (cancelled) return;
        setAccounts(loadedAccounts);
        setRates(loadedRates);
        const topped = await ensureTodayRates(loadedRates);
        if (!cancelled) setRates(topped);
      } catch (e) {
        if (!cancelled) fail(e);
      }
    })();
    return () => { cancelled = true; };
  }, [fail]);

  const handleChange = useCallback(async (id: number, patch: Partial<Account>) => {
    setError(null);
    let previous: Account[] = [];
    setAccounts((list) => {
      previous = list;
      return list.map((a) => (a.id === id ? { ...a, ...patch } : a));
    });
    try {
      await updateAccount(id, patch);
    } catch (e) {
      setAccounts(previous); // an optimistic update must not survive a failed write
      fail(e);
    }
  }, [fail]);

  const handleDelete = useCallback(async (id: number) => {
    setConfirmingId(null);
    let previous: Account[] = [];
    setAccounts((list) => {
      previous = list;
      return list.filter((a) => a.id !== id);
    });
    try {
      await deleteAccount(id);
    } catch (e) {
      setAccounts(previous);
      fail(e);
    }
  }, [fail]);

  async function commitDraft() {
    const trimmed = draftName.trim();
    setDrafting(false);
    setDraftName('');
    if (!trimmed) return;
    try {
      const created = await addAccount({ name: trimmed, icon: '🏦', currency: base, balance: 0 });
      setAccounts((list) => [...list, created]);
    } catch (e) { fail(e); }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      // Drop today's rows so ensureTodayRates re-fetches rather than short-circuiting.
      const withoutToday = rates.filter((r) => r.rateDate !== today);
      setRates(await ensureTodayRates(withoutToday));
    } catch (e) { fail(e); }
    finally { setRefreshing(false); }
  }

  /**
   * EUR is the one currency with real history available — the ECB publishes a
   * full series. Bolivar history has no free source and stays manual.
   */
  async function handleBackfillEur() {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const months = await listMonths();
      const earliest = months.length > 0 ? months[months.length - 1] : today;
      const days = await fetchEcbRange(earliest, today);
      const known = new Set(
        rates.filter((r) => r.currency === 'EUR').map((r) => r.rateDate),
      );
      const missing = days.filter((d) => !known.has(d.date));
      for (const day of missing) {
        await upsertRate({
          currency: 'EUR', rateDate: day.date, unitsPerUsd: day.unitsPerUsd, source: 'ecb',
        });
      }
      if (missing.length > 0) setRates(await listRates());
      setBackfillResult(missing.length);
    } catch (e) {
      fail(e);
    } finally {
      setBackfilling(false);
    }
  }

  async function handleSaveRate(currency: 'EUR' | 'VES', date: string, unitsPerUsd: number) {
    const row: RateRow = { currency, rateDate: date, unitsPerUsd, source: 'manual' };
    try {
      await upsertRate(row);
      setRates((list) => [
        ...list.filter((r) => !(r.currency === currency && r.rateDate === date)),
        row,
      ]);
    } catch (e) { fail(e); }
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-5">
      <header className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="text-muted text-sm hover:text-text">
          ← Back to budget
        </button>
      </header>

      <div>
        <h1 className="text-3xl font-extrabold">Accounts</h1>
        <p className="text-muted text-sm">What you hold, across every currency.</p>
      </div>

      {error && <div className="text-negative text-xs">{error}</div>}

      <section className="bg-card rounded-xl p-4 space-y-1.5">
        {accounts.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            onChange={handleChange}
            onDelete={handleDelete}
            confirmingDelete={confirmingId === account.id}
            onRequestDelete={setConfirmingId}
            onCancelDelete={() => setConfirmingId(null)}
          />
        ))}

        {drafting && (
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
            placeholder="New account name"
            className="w-full px-2 py-1 border border-highlight rounded-md bg-card text-sm"
          />
        )}

        <button
          type="button"
          onClick={() => setDrafting(true)}
          disabled={drafting}
          className="mt-2 w-full text-xs text-muted bg-bg rounded-lg px-2.5 py-1.5 disabled:opacity-50"
          style={{ border: '1px dashed var(--dashed)' }}
        >
          + Add account
        </button>
      </section>

      <TotalAvailable accounts={accounts} rates={rates} base={base} date={today} />

      <ExchangeRatesPanel
        rates={rates}
        date={today}
        onSaveRate={handleSaveRate}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onBackfillEur={handleBackfillEur}
        backfilling={backfilling}
        backfillResult={backfillResult}
      />
    </div>
  );
}
