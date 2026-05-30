import { useEffect, useState } from 'react';
import { renameCategory, setCategoryIcon } from '../api/categories';
import EmojiPicker from './EmojiPicker';
import type { Category } from '../types';

type Props = {
  category: Category;
  onChange: (next: Category) => void;
  onDelete: (category: Category) => void;
  onCategoryChanged?: (action: 'renamed' | 'icon') => void;
  dragHandleLabel?: string;
};

export default function CategoryRow({
  category,
  onChange,
  onDelete,
  onCategoryChanged,
  dragHandleLabel,
}: Props) {
  const [name, setName] = useState(category.name);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => setName(category.name), [category.name]);

  async function saveName() {
    const next = name.trim();
    if (!next) { setName(category.name); return; }
    if (next === category.name) return;
    const previous = category;
    onChange({ ...category, name: next });
    try {
      await renameCategory(category.id, next);
      onCategoryChanged?.('renamed');
    } catch {
      onChange(previous);
      setName(previous.name);
    }
  }

  async function pickIcon(emoji: string) {
    setPickerOpen(false);
    if (emoji === category.icon) return;
    const previous = category;
    onChange({ ...category, icon: emoji });
    try {
      await setCategoryIcon(category.id, emoji);
      onCategoryChanged?.('icon');
    } catch {
      onChange(previous);
    }
  }

  return (
    <div
      className="grid items-center gap-2 bg-bg rounded-lg p-2"
      style={{ gridTemplateColumns: '24px 32px 1fr 28px' }}
    >
      <button
        type="button"
        aria-label={dragHandleLabel ?? 'Drag handle'}
        className="text-muted cursor-grab text-sm"
        draggable
      >
        ⋮⋮
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={`Change icon for ${category.name}`}
          className="text-xl hover:bg-card rounded-md w-full text-center"
        >
          {category.icon}
        </button>
        {pickerOpen && (
          <div className="absolute z-10 mt-1">
            <EmojiPicker onPick={pickIcon} onClose={() => setPickerOpen(false)} />
          </div>
        )}
      </div>
      <input
        type="text"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveName}
        className="w-full px-2 py-1 border border-highlight rounded-md bg-card text-sm"
      />
      <button
        type="button"
        onClick={() => onDelete(category)}
        aria-label={`Delete ${category.name}`}
        className="text-muted hover:text-negative"
      >
        🗑
      </button>
    </div>
  );
}
