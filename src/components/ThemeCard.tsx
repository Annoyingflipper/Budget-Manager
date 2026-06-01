import type { Theme } from '../theme/types';

type Props = {
  theme: Theme;
  selected: boolean;
  onSelect: () => void;
};

type ThemeMeta = {
  label: string;
  emoji: string;
  tagline: string;
  swatches: string[];
};

const META: Record<Theme, ThemeMeta> = {
  peach: {
    label: 'Peach',
    emoji: '🍑',
    tagline: 'Sunlit kitchen',
    swatches: ['#fef3ec', '#f5d5c0', '#86a578', '#b54545'],
  },
  sage: {
    label: 'Sage',
    emoji: '🌿',
    tagline: 'Botanical study',
    swatches: ['#f4f6ee', '#d5e3c0', '#6a9558', '#c05454'],
  },
  lavender: {
    label: 'Lavender',
    emoji: '🌙',
    tagline: 'Soft evening',
    swatches: ['#f5f0fa', '#e0d5f5', '#7a9572', '#c05478'],
  },
};

export default function ThemeCard({ theme, selected, onSelect }: Props) {
  const meta = META[theme];
  return (
    <button
      type="button"
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      aria-label={`${meta.label} theme`}
      className={`text-left bg-card rounded-xl p-3 transition-all border-2 ${
        selected ? 'border-negative' : 'border-transparent hover:border-dashed'
      }`}
    >
      <div className="flex gap-1 mb-2">
        {meta.swatches.map((color) => (
          <div
            key={color}
            className="w-5 h-5 rounded-sm"
            style={{ backgroundColor: color, border: '1px solid rgba(0,0,0,0.08)' }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between font-extrabold text-sm">
        <span>{meta.emoji} {meta.label}</span>
        {selected && <span className="text-negative">●</span>}
      </div>
      <div className="text-muted text-xs">{meta.tagline}</div>
    </button>
  );
}
