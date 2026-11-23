'use client';

import { X } from 'lucide-react';

type Chip = { key: string; label: string };

type Props = {
  chips: Chip[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
  removeLabel: (label: string) => string;
  clearAllLabel: string;
  ariaLabel: string;
};

export function ActiveFilterChips({
  chips,
  onRemove,
  onClearAll,
  removeLabel,
  clearAllLabel,
  ariaLabel,
}: Props) {
  if (chips.length === 0) return null;

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2 mb-4">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip.key)}
          aria-label={removeLabel(chip.label)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[32px] rounded-full text-xs font-semibold border bg-primary/10 border-primary text-primary hover:bg-primary/15 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {chip.label}
          <X size={12} aria-hidden="true" />
        </button>
      ))}
      {chips.length >= 2 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-semibold text-muted-foreground hover:text-foreground underline-offset-2 hover:underline px-1"
        >
          {clearAllLabel}
        </button>
      )}
    </div>
  );
}
