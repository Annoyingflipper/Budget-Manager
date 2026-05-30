type Props = {
  categoryName: string;
  categoryIcon: string;
  onAddFirst: () => void;
};

export default function EmptyCategoryCard({ categoryName, categoryIcon, onAddFirst }: Props) {
  return (
    <section
      className="rounded-xl p-4 mb-3 text-center bg-card/50"
      style={{ border: '2px dashed var(--dashed)' }}
    >
      <div className="text-2xl mb-0.5">{categoryIcon}</div>
      <div className="font-extrabold text-sm">{categoryName}</div>
      <div className="text-xs text-muted">Nothing here yet</div>
      <button
        type="button"
        onClick={onAddFirst}
        className="mt-1.5 bg-card border border-highlight rounded-lg px-2.5 py-1 text-xs"
      >
        + Add first {categoryName.toLowerCase().split(' ')[0]}
      </button>
    </section>
  );
}
