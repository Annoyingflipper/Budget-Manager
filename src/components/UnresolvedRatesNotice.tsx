import type { CategoryWithItems } from '../types';

type Props = {
  categories: CategoryWithItems[];
  onOpenRates: () => void;
};

/**
 * When an expense carries a currency but no rate is known for its date, its
 * converted value falls back to the native number — which would quietly inflate
 * or deflate every total. This makes that visible and tells the user how to fix
 * it, rather than letting a wrong figure pass as correct.
 */
export default function UnresolvedRatesNotice({ categories, onOpenRates }: Props) {
  const affected = categories.flatMap((c) => c.items).filter((i) => !i.rateResolved);
  if (affected.length === 0) return null;

  const noun = affected.length === 1 ? 'expense' : 'expenses';

  return (
    <section
      data-testid="unresolved-rates"
      className="bg-card rounded-xl p-3 mb-4 border border-warning"
    >
      <div className="text-sm">
        <span className="text-warning font-bold">⚠</span>{' '}
        <span className="font-bold">
          {affected.length} {noun}
        </span>{' '}
        <span className="text-muted">
          use a currency with no known rate for their date, so they are counted at
          face value in your totals.
        </span>
      </div>
      <button
        type="button"
        onClick={onOpenRates}
        className="mt-2 text-xs bg-bg rounded-md px-2.5 py-1"
      >
        Set a rate →
      </button>
    </section>
  );
}
