type Props = {
  categoryName: string;
  categoryIcon: string;
  onAddFirst: () => void;
};

export default function EmptyCategoryCard({ categoryName, categoryIcon, onAddFirst }: Props) {
  return (
    <section
      className="rounded-card p-4 mb-3 text-center bg-card/50"
      style={{ border: '2px dashed var(--dashed)' }}
    >
      <div className="text-heading mb-0.5">{categoryIcon}</div>
      <div className="text-heading">{categoryName}</div>
      <div className="text-caption text-muted">Nothing here yet</div>
      <button
        type="button"
        onClick={onAddFirst}
        className="mt-1.5 bg-card border border-highlight rounded-control px-2.5 py-1 text-label"
      >
        + Add first {categoryName.toLowerCase().split(' ')[0]}
      </button>
    </section>
  );
}
