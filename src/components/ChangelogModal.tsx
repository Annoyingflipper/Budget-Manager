import type { ChangelogEntry } from '../changelog';

type Props = {
  entry: ChangelogEntry;
  onDismiss: () => void;
  showAllAfter?: ChangelogEntry[];
};

export default function ChangelogModal({ entry, onDismiss, showAllAfter }: Props) {
  return (
    <div
      data-testid="changelog-backdrop"
      role="dialog"
      aria-label={`What's new in v${entry.version}`}
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onDismiss}
    >
      <div
        className="bg-card rounded-card p-5 max-w-md w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-caption text-muted">What's new in v{entry.version}</div>
            <div className="text-heading">{entry.title}</div>
            <div className="text-caption text-muted">{entry.date}</div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className="text-muted hover:text-text text-label"
          >
            ✕
          </button>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-body mb-4">
          {entry.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        {showAllAfter && showAllAfter.length > 0 && (
          <div className="border-t border-highlight pt-3 mt-3 space-y-3">
            <div className="text-label uppercase text-muted">Earlier releases</div>
            {showAllAfter.map((older) => (
              <div key={older.version}>
                <div className="text-label">v{older.version} — {older.title}</div>
                <div className="text-caption text-muted mb-1">{older.date}</div>
                <ul className="list-disc pl-5 space-y-0.5 text-caption">
                  {older.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="bg-positive text-white text-label px-3 py-1.5 rounded-control"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
