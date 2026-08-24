import { useCallback, useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import AuthGate from './auth/AuthGate';
import { ThemeProvider } from './theme/ThemeProvider';
import Header from './components/Header';
import BalanceHero from './components/BalanceHero';
import IncomeSummary from './components/IncomeSummary';
import StillToPay from './components/StillToPay';
import ComingUp from './components/ComingUp';
import UnresolvedRatesNotice from './components/UnresolvedRatesNotice';
import CategoryTable from './components/CategoryTable';
import GrandTotals from './components/GrandTotals';
import Toast from './components/Toast';
import ChangelogModal from './components/ChangelogModal';
import Settings from './pages/Settings';
import Insights from './pages/Insights';
import Accounts from './pages/Accounts';
import TotalAvailable from './components/TotalAvailable';
import { getBudget, listMonths, rolloverMonth, deleteMonth } from './api/budget';
import { getLastSeenChangelogVersion, setLastSeenChangelogVersion, getBaseCurrency } from './api/userPrefs';
import { listAccounts } from './api/accounts';
import { listRates, ensureTodayRates } from './api/rates';
import { listAttachments } from './api/attachments';
import { todayISO } from './utils/date';
import { CHANGELOG, LATEST_VERSION } from './changelog';
import { formatMonth, formatMonthLabel, nextMonth, prevMonth } from './utils/month';
import type { Currency } from './utils/currency';
import type { RateRow } from './utils/rates';
import type { Account, Attachment, Budget, CategoryWithItems, Income } from './types';

type Page = 'budget' | 'settings' | 'insights' | 'accounts';
type CategoryAction = 'added' | 'renamed' | 'icon' | 'deleted' | 'reordered';

const TOAST_COPY: Record<CategoryAction, string> = {
  added: 'Category added.',
  renamed: 'Category renamed.',
  icon: 'Icon updated.',
  deleted: 'Category deleted.',
  reordered: 'Order saved.',
};

function BudgetApp() {
  const [selectedMonth, setSelectedMonth] = useState<string>(formatMonth(new Date()));
  const [latestMonth, setLatestMonth] = useState<string | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>('budget');
  const [bootstrapped, setBootstrapped] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rates, setRates] = useState<RateRow[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<Currency>('USD');

  useEffect(() => {
    let cancelled = false;
    listMonths()
      .then((months) => {
        if (cancelled) return;
        const initial = months[0] ?? formatMonth(new Date());
        setSelectedMonth(initial);
        setLatestMonth(months[0] ?? null);
        setBootstrapped(true);
      })
      .catch((e) => { if (!cancelled) setError(e?.message ?? String(e)); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    let cancelled = false;
    getBudget(selectedMonth)
      .then((b) => { if (!cancelled) setBudget(b); })
      .catch((e) => { if (!cancelled) setError(e?.message ?? String(e)); });
    listMonths()
      .then((months) => { if (!cancelled) setLatestMonth(months[0] ?? null); })
      .catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, [selectedMonth, bootstrapped, refreshCounter]);

  useEffect(() => {
    let cancelled = false;
    getLastSeenChangelogVersion()
      .then((v) => {
        if (cancelled) return;
        if (v !== LATEST_VERSION) setChangelogOpen(true);
      })
      .catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // All three are non-fatal: an accounts or rates problem must never stop
    // the budget itself from rendering.
    listAccounts()
      .then((a) => { if (!cancelled) setAccounts(a); })
      .catch(() => { /* non-fatal */ });
    getBaseCurrency()
      .then((c) => { if (!cancelled) setBaseCurrency(c); })
      .catch(() => { /* non-fatal */ });
    listRates()
      .then(async (r) => {
        if (cancelled) return;
        setRates(r);
        const topped = await ensureTodayRates(r);
        if (!cancelled) setRates(topped);
      })
      .catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, [refreshCounter]);

  const reloadAttachments = useCallback(() => {
    if (!budget) return;
    const ids = budget.categories.flatMap((c) => c.items).map((i) => i.id);
    listAttachments(ids)
      .then(setAttachments)
      .catch(() => { /* non-fatal: rows simply show no receipts */ });
  }, [budget]);

  useEffect(() => { reloadAttachments(); }, [reloadAttachments]);

  const updateIncomeLocal = useCallback((patch: Partial<Income>) => {
    setBudget((b) => (b ? { ...b, income: { ...b.income, ...patch } } : b));
  }, []);

  const updateCategoryLocal = useCallback(
    (id: number, next: CategoryWithItems) => {
      setBudget((b) =>
        b ? { ...b, categories: b.categories.map((c) => (c.id === id ? next : c)) } : b
      );
    },
    [],
  );

  const handlePrev = useCallback(() => {
    setSelectedMonth((m) => prevMonth(m));
  }, []);

  const handleNext = useCallback(() => {
    setSelectedMonth((m) => nextMonth(m));
  }, []);

  const handleRollover = useCallback(async () => {
    const target = nextMonth(selectedMonth);
    const label = formatMonthLabel(target);
    const fromLabel = formatMonthLabel(selectedMonth);
    const confirmed = window.confirm(
      `Start ${label}? This copies item names and projected values from ${fromLabel}. Actuals start at zero.`,
    );
    if (!confirmed) return;
    try {
      await rolloverMonth(selectedMonth, target);
      setSelectedMonth(target);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('already has data')) {
        setSelectedMonth(target);
        return;
      }
      setError(msg);
    }
  }, [selectedMonth]);

  const handleDelete = useCallback(async () => {
    const label = formatMonthLabel(selectedMonth);
    const confirmed = window.confirm(
      `Delete ${label}? This permanently removes all income and line items for that month.`,
    );
    if (!confirmed) return;
    try {
      await deleteMonth(selectedMonth);
      setSelectedMonth(prevMonth(selectedMonth));
      setRefreshCounter((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [selectedMonth]);

  const handleCategoriesChanged = useCallback((action: CategoryAction) => {
    setRefreshCounter((n) => n + 1);
    setToast({ message: TOAST_COPY[action], type: 'success' });
  }, []);

  const dismissChangelog = useCallback(async () => {
    setChangelogOpen(false);
    try { await setLastSeenChangelogVersion(LATEST_VERSION); }
    catch { /* non-fatal */ }
  }, []);

  if (error) return <div className="p-8 text-negative">Error: {error}</div>;
  if (!budget) return <div className="p-8 text-muted">Loading budget…</div>;

  return (
    <>
      {page === 'settings' ? (
        <Settings
          onBack={() => setPage('budget')}
          onCategoriesChanged={handleCategoriesChanged}
          onOpenChangelog={() => setChangelogOpen(true)}
        />
      ) : page === 'accounts' ? (
        <Accounts onBack={() => setPage('budget')} base={baseCurrency} />
      ) : page === 'insights' ? (
        <Insights
          selectedMonth={selectedMonth}
          budget={budget}
          onBack={() => setPage('budget')}
          base={baseCurrency}
        />
      ) : (
        <div className="mx-auto max-w-3xl p-6">
          <Header
            selectedMonth={selectedMonth}
            latestMonth={latestMonth}
            onPrev={handlePrev}
            onNext={handleNext}
            onRollover={handleRollover}
            canDelete={selectedMonth > formatMonth(new Date())}
            onDelete={handleDelete}
            onOpenSettings={() => setPage('settings')}
            onOpenInsights={() => setPage('insights')}
            onOpenAccounts={() => setPage('accounts')}
          />
          <BalanceHero income={budget.income} categories={budget.categories} />
          <TotalAvailable
            accounts={accounts}
            rates={rates}
            base={baseCurrency}
            date={todayISO()}
            compact
            onOpen={() => setPage('accounts')}
          />
          <IncomeSummary
            income={budget.income}
            periodMonth={selectedMonth}
            onChange={updateIncomeLocal}
          />
          <StillToPay categories={budget.categories} />
          <ComingUp
            categories={budget.categories}
            accounts={accounts}
            rates={rates}
            base={baseCurrency}
            month={selectedMonth}
          />
          <UnresolvedRatesNotice
            categories={budget.categories}
            onOpenRates={() => setPage('accounts')}
          />
          {budget.categories.map((c) => (
            <CategoryTable
              key={c.id}
              category={c}
              periodMonth={selectedMonth}
              onCategoryChange={(next) => updateCategoryLocal(c.id, next)}
              base={baseCurrency}
              rates={rates}
              attachments={attachments}
              onAttachmentsChange={reloadAttachments}
            />
          ))}
          <GrandTotals categories={budget.categories} />
        </div>
      )}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
      {changelogOpen && (
        <ChangelogModal
          entry={CHANGELOG[0]}
          onDismiss={dismissChangelog}
          showAllAfter={CHANGELOG.slice(1)}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <>
      <AuthGate>
        <ThemeProvider>
          <BudgetApp />
        </ThemeProvider>
      </AuthGate>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
