import { useCallback, useEffect, useState } from 'react';
import AuthGate from './auth/AuthGate';
import IncomeSummary from './components/IncomeSummary';
import CategoryTable from './components/CategoryTable';
import GrandTotals from './components/GrandTotals';
import { getBudget } from './api/budget';
import { supabase } from './lib/supabase';
import type { Budget, CategoryWithItems, Income } from './types';

function BudgetApp() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!budget) return <div className="p-8">Loading budget…</div>;

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold">Budget Manager</h1>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="text-sm text-gray-500 underline"
        >
          Log out
        </button>
      </header>

      <IncomeSummary
        income={budget.income}
        categories={budget.categories}
        onChange={updateIncomeLocal}
      />

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
      <BudgetApp />
    </AuthGate>
  );
}
