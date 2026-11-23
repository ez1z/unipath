'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { X } from 'lucide-react';

type Chip = { key: string; label: string };

type Props = {
  chips: Chip[];
  onRemove: (key: string) => void;
  onClearAll: () => void;
  removeLabel: (label: string) => string;
  clearAllLabel: string;
  ariaLabel: string;
  /** Receives focus when the last chip is removed (e.g. the Filters button). */
  fallbackFocusRef?: RefObject<HTMLElement | null>;
};

export function ActiveFilterChips({
  chips,
  onRemove,
  onClearAll,
  removeLabel,
  clearAllLabel,
  ariaLabel,
  fallbackFocusRef,
}: Props) {
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());
  // Index of the chip that was just removed; once the parent re-renders without
  // it, focus moves to the chip now in that slot (the next one, or the previous
  // one if it was last) so keyboard users don't get dropped onto <body>.
  const pendingFocusIndex = useRef<number | null>(null);

  useEffect(() => {
    const index = pendingFocusIndex.current;
    if (index === null) return;
    pendingFocusIndex.current = null;
    if (chips.length === 0) {
      fallbackFocusRef?.current?.focus();
      return;
    }
    chipRefs.current.get(chips[Math.min(index, chips.length - 1)].key)?.focus();
  }, [chips, fallbackFocusRef]);

  if (chips.length === 0) return null;

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-2 mb-4">
      {chips.map((chip, index) => (
        <button
          key={chip.key}
          ref={(el) => {
            if (el) chipRefs.current.set(chip.key, el);
            else chipRefs.current.delete(chip.key);
          }}
          type="button"
          onClick={() => {
            pendingFocusIndex.current = index;
            onRemove(chip.key);
          }}
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
          onClick={() => {
            pendingFocusIndex.current = 0;
            onClearAll();
          }}
          className="inline-flex items-center min-h-[32px] px-2 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {clearAllLabel}
        </button>
      )}
    </div>
  );
}
