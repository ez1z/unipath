'use client';

import { useState, useRef, useEffect } from 'react';

export type SelectOption = {
  value: string;
  label: string;
  muted?: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  'aria-label'?: string;
  className?: string;
};

export function Select({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value && o.value !== '');
  const placeholderLabel = options.find((o) => o.value === '')?.label ?? '—';

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocusedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>('[role="option"]');
    items[focusedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) setFocusedIndex(Math.max(0, options.findIndex((o) => o.value === value)));
    else setFocusedIndex(-1);
  }

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setFocusedIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        setOpen(false);
        setFocusedIndex(-1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!open) { toggle(); break; }
        if (focusedIndex >= 0) pick(options[focusedIndex].value);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) { setOpen(true); setFocusedIndex(0); break; }
        setFocusedIndex((i) => Math.min(i + 1, options.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        break;
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={toggle}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-input rounded-lg text-sm bg-card hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors text-left cursor-pointer"
      >
        <span className={`truncate ${selectedOption ? 'text-foreground' : 'text-muted-foreground'}`}>
          {selectedOption?.label ?? placeholderLabel}
        </span>
        {/* Chevron */}
        <svg
          className={`flex-shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          ref={listRef}
          className="absolute z-50 top-full mt-1.5 w-full min-w-[200px] bg-card border border-border rounded-xl shadow-card-hover overflow-hidden"
        >
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map((option, i) => {
              const isSelected = option.value === value;
              const isFocused = i === focusedIndex;

              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setFocusedIndex(i)}
                  onMouseLeave={() => setFocusedIndex(-1)}
                  onClick={() => pick(option.value)}
                  className={[
                    'flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm cursor-pointer select-none transition-colors border-l-2',
                    isSelected
                      ? 'bg-secondary font-semibold text-primary border-l-gold'
                      : isFocused
                      ? 'bg-secondary text-foreground border-l-transparent'
                      : 'text-foreground hover:bg-secondary border-l-transparent',
                    option.muted ? '!text-muted-foreground' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && option.value !== '' && (
                    <svg
                      className="text-gold flex-shrink-0"
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
