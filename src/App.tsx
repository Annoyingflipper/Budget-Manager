import { useCallback, useEffect, useState } from 'react';
import AuthGate from './auth/AuthGate';
import { ThemeProvider } from './theme/ThemeProvider';
import Header from './components/Header';
import BalanceHero from './components/BalanceHero';
import IncomeSummary from './components/IncomeSummary';
import CategoryTable from './components/CategoryTable';
import GrandTotals from './components/GrandTotals';
import Settings from './pages/Settings';
import { getBudget } from './api/budget';
import type { Budget, CategoryWithItems, Income } from './types';

type Page = 'budget' | 'settings';

function BudgetApp() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>('budget');

  useEffect(() => {
    getBudget()
      .then(setBudget)
      .catch((e) => setError(e?.message ?? String(e)));
  }, []);

  const updateIncomeLocal = useCallback((patch: Partial<Income>) => {
    setBudget((b) => (b ? { ...b, income: { ...b.income, ...patch } } : b));
  }, []);

  const updateCategoryLocal = useCallback(
    (id: number, next: CategoryWithItems) => {
      setBudget((b) =>
        b ? { ...b, categories: b.categories.map((c) => (c.id === id ? next : c)) } : b
      );
    },
    []
  );

  if (error) return <div className="p-8 text-negative">Error: {error}</div>;
  if (!budget) return <div className="p-8 text-muted">Loading budget…</div>;

  if (page === 'settings') {
    return <Settings onBack={() => setPage('budget')} />;
  }

  const now = new Date();
  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Header monthLabel={monthLabel} onOpenSettings={() => setPage('settings')} />
      <BalanceHero income={budget.income} categories={budget.categories} />
      <IncomeSummary income={budget.income} onChange={updateIncomeLocal} />
      {budget.categories.map((c) => (
        <CategoryTable
          key={c.id}
          category={c}
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
