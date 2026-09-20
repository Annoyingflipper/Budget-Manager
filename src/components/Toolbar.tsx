import { formatMonthLabel, nextMonth } from '../utils/month';

type Props = {
  selectedMonth: string;
  latestMonth: string | null;
  onPrev: () => void;
  onNext: () => void;
  onRollover: () => void;
  canDelete: boolean;
  onDelete: () => void;
};

/**
 * Month controls for the dashboard.
 *
 * Deliberately NOT part of the navigation: these act on what the dashboard is
 * showing, not on which page you are on. In the sidebar they would imply they
 * also apply to Settings and Accounts, which they do not.
 */
export default function Toolbar({
  selectedMonth,
  latestMonth,
  onPrev,
  onNext,
  onRollover,
  canDelete,
  onDelete,
}: Props) {
  const showRollover = latestMonth === null || selectedMonth >= latestMonth;
  const nextLabel = formatMonthLabel(nextMonth(selectedMonth));

  return (
    <div data-testid="month-toolbar" className="flex items-center gap-2 mb-4">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous month"
        className="bg-card border-0 rounded-control px-2 py-1 text-label"
      >
        ←
      </button>
      <span className="text-label text-muted min-w-28 text-center">
        {formatMonthLabel(selectedMonth)}
      </span>
      {showRollover ? (
        <button
          type="button"
          onClick={onRollover}
          className="bg-card border-0 rounded-control px-2.5 py-1 text-label"
        >
          Start {nextLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={onNext}
          aria-label="Next month"
          className="bg-card border-0 rounded-control px-2 py-1 text-label"
        >
          →
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete this month"
          className="bg-card border-0 rounded-control px-2.5 py-1 text-label text-negative"
        >
          🗑 Delete this month
        </button>
      )}
    </div>
  );
}
