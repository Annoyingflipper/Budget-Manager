import { useCallback, useEffect, useState } from 'react';
import AuthGate from './auth/AuthGate';
import { ThemeProvider } from './theme/ThemeProvider';
import Header from './components/Header';
import BalanceHero from './components/BalanceHero';
import IncomeSummary from './components/IncomeSummary';
import CategoryTable from './components/CategoryTable';
import GrandTotals from './components/GrandTotals';
import Settings from './pages/Settings';
import { getBudget, listMonths, rolloverMonth } from './api/budget';
import { formatMonth, formatMonthLabel, nextMonth, prevMonth } from './utils/month';
import type { Budget, CategoryWithItems, Income } from './types';

type Page = 'budget' | 'settings';

function BudgetApp() {
  const [selectedMonth, setSelectedMonth] = useState<string>(formatMonth(new Date()));
  const [latestMonth, setLatestMonth] = useState<string | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>('budget');
  const [bootstrapped, setBootstrapped] = useState(false);

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
  }, [selectedMonth, bootstrapped]);

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

  if (error) return <div className="p-8 text-negative">Error: {error}</div>;
  if (!budget) return <div className="p-8 text-muted">Loading budget…</div>;

  if (page === 'settings') {
    return <Settings onBack={() => setPage('budget')} />;
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Header
        selectedMonth={selectedMonth}
        latestMonth={latestMonth}
        onPrev={handlePrev}
        onNext={handleNext}
        onRollover={handleRollover}
        onOpenSettings={() => setPage('settings')}
      />
      <BalanceHero income={budget.income} categories={budget.categories} />
      <IncomeSummary
        income={budget.income}
        periodMonth={selectedMonth}
        onChange={updateIncomeLocal}
      />
      {budget.categories.map((c) => (
        <CategoryTable
          key={c.id}
          category={c}
          periodMonth={selectedMonth}
          onCategoryChange={(next) => updateCategoryLocal(c.id, next)}
        />
      ))}
      <GrandTotals categories={budget.categories} />
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <ThemeProvider>
        <BudgetApp />
      </ThemeProvider>
    </AuthGate>
  );
}
