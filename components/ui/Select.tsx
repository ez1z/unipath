'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/** Semantic colour for an option, drawn from the Turkmen palette. */
export type SelectTone = 'crimson' | 'gold' | 'green' | 'primary' | 'muted';

export type SelectOption = {
  value: string;
  label: string;
  muted?: boolean;
  tone?: SelectTone;
};

const TONE_DOT: Record<SelectTone, string> = {
  crimson: 'bg-crimson',
  gold: 'bg-gold',
  green: 'bg-tk-green',
  primary: 'bg-primary',
  muted: 'bg-muted-foreground/40',
};

const TONE_TRIGGER: Record<SelectTone, string> = {
  crimson: 'bg-crimson-light/40 border-crimson/30 text-crimson-dark',
  gold: 'bg-gold-light/50 border-gold/50 text-gold-dark',
  green: 'bg-tk-green-light/60 border-tk-green/30 text-tk-green',
  primary: 'bg-primary/10 border-primary/30 text-primary',
  muted: 'bg-card border-input text-muted-foreground',
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  'aria-label'?: string;
  className?: string;
  /** Lets the trigger act as a text input that filters the option list while typing. */
  searchable?: boolean;
  /**
   * Render the panel into document.body. Required inside a scroll container
   * (an `overflow-x-auto` table clips an absolutely positioned panel).
   */
  portal?: boolean;
  /** Tint the trigger with the selected option's tone — for categorical values. */
  tinted?: boolean;
  size?: 'sm' | 'md';
};

function Dot({ tone }: { tone: SelectTone }) {
  return (
    <span
      className={`w-2 h-2 rounded-full flex-shrink-0 ${TONE_DOT[tone]}`}
      aria-hidden="true"
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
  className = '',
  searchable = false,
  portal = false,
  tinted = false,
  size = 'md',
}: Props) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value && o.value !== '');
  const placeholderLabel = options.find((o) => o.value === '')?.label ?? '—';

  const filteredOptions =
    searchable && query.trim()
      ? options.filter(
          (o) => o.value !== '' && o.label.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : options;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      // The panel may be portalled outside the container, so it has to be
      // checked separately — otherwise mousedown closes it before the option's
      // click lands and nothing is ever selectable.
      const inside =
        containerRef.current?.contains(target) || listRef.current?.contains(target);
      if (!inside) {
        setOpen(false);
        setFocusedIndex(-1);
        setQuery('');
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

  // A portalled panel is positioned from the trigger's viewport rect, so it has
  // to be re-measured whenever the page moves under it.
  const measure = useCallback(() => {
    if (containerRef.current) setRect(containerRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!portal || !open) return;
    const close = () => setOpen(false);
    // Scrolling the option list itself must not dismiss it — only movement of
    // the page or the table underneath invalidates the measured position.
    const onScroll = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return;
      close();
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [portal, open]);

  function openDropdown() {
    measure();
    setOpen(true);
    setFocusedIndex(Math.max(0, options.findIndex((o) => o.value === value)));
  }

  function toggle() {
    if (open) {
      setOpen(false);
      setFocusedIndex(-1);
    } else {
      openDropdown();
    }
  }

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setFocusedIndex(-1);
    setQuery('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        setOpen(false);
        setFocusedIndex(-1);
        setQuery('');
        (e.target as HTMLElement).blur?.();
        break;
      case 'Enter':
        e.preventDefault();
        if (!open) { openDropdown(); break; }
        if (focusedIndex >= 0 && filteredOptions[focusedIndex]) pick(filteredOptions[focusedIndex].value);
        break;
      case ' ':
        if (searchable) break;
        e.preventDefault();
        if (!open) { openDropdown(); break; }
        if (focusedIndex >= 0 && filteredOptions[focusedIndex]) pick(filteredOptions[focusedIndex].value);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!open) { openDropdown(); break; }
        setFocusedIndex((i) => Math.min(i + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        break;
    }
  }

  const renderPanel = (panel: React.ReactNode) =>
    portal && typeof document !== 'undefined' ? createPortal(panel, document.body) : panel;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      {searchable ? (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={open ? query : selectedOption?.label ?? ''}
            onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); setFocusedIndex(0); }}
            onFocus={() => { setQuery(''); openDropdown(); }}
            onKeyDown={handleKeyDown}
            placeholder={placeholderLabel}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={ariaLabel}
            autoComplete="off"
            className={`w-full pl-3.5 pr-9 border border-input rounded-lg bg-card hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors placeholder:text-muted-foreground ${
              size === 'sm' ? 'py-2 text-[13px]' : 'py-3 text-[15px]'
            }`}
          />
          <svg
            className={`absolute right-3 top-1/2 -translate-y-1/2 flex-shrink-0 text-muted-foreground transition-transform duration-200 pointer-events-none ${open ? 'rotate-180' : ''}`}
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
        </div>
      ) : (
        <button
          type="button"
          onClick={toggle}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          className={[
            'w-full flex items-center justify-between gap-2 border rounded-lg font-medium',
            'hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30',
            'transition-colors text-left cursor-pointer',
            size === 'sm' ? 'px-2.5 py-2 text-[13px]' : 'px-3 py-2.5 text-[15px]',
            tinted && selectedOption?.tone
              ? TONE_TRIGGER[selectedOption.tone]
              : 'bg-card border-input text-foreground',
          ].join(' ')}
        >
          <span className="flex items-center gap-2 min-w-0">
            {selectedOption?.tone && !tinted && <Dot tone={selectedOption.tone} />}
            <span className={`truncate ${selectedOption ? '' : 'text-muted-foreground font-normal'}`}>
              {selectedOption?.label ?? placeholderLabel}
            </span>
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
      )}

      {/* Dropdown panel */}
      {open && renderPanel(
        <div
          role="listbox"
          aria-label={ariaLabel}
          ref={listRef}
          style={
            portal && rect
              ? {
                  position: 'fixed',
                  top: rect.bottom + 6,
                  left: rect.left,
                  width: Math.max(rect.width, 220),
                }
              : undefined
          }
          className={
            portal
              ? 'z-50 bg-card border border-border rounded-xl shadow-card-hover overflow-hidden'
              : 'absolute z-50 top-full mt-1.5 w-full min-w-[200px] bg-card border border-border rounded-xl shadow-card-hover overflow-hidden'
          }
        >
          <div className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length === 0 && (
              <div className="px-3.5 py-2.5 text-sm text-muted-foreground select-none">—</div>
            )}
            {filteredOptions.map((option, i) => {
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
                    'flex items-center justify-between gap-2 px-3.5 py-3 text-[15px] cursor-pointer select-none transition-colors border-l-2',
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
                  <span className="flex items-center gap-2.5 min-w-0">
                    {option.tone && <Dot tone={option.tone} />}
                    <span className="truncate">{option.label}</span>
                  </span>
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
