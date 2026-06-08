'use client';

import { useState, useRef, useEffect } from 'react';

type Option = { value: string; label: string };

type Props = {
  displayOptions: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
};

export function MultiTagSelect({ displayOptions, selected, onChange, placeholder }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = displayOptions.filter(
    (o) =>
      !selected.includes(o.value) &&
      o.label.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function select(value: string) {
    onChange([...selected, value]);
    setQuery('');
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function remove(value: string) {
    onChange(selected.filter((v) => v !== value));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0 && filtered[activeIndex]) {
      e.preventDefault();
      select(filtered[activeIndex].value);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    } else if (e.key === 'Backspace' && query === '' && selected.length > 0) {
      onChange(selected.slice(0, -1));
    }
  }

  const selectedLabels = selected.map((v) => {
    const opt = displayOptions.find((o) => o.value === v);
    return { value: v, label: opt?.label ?? v };
  });

  return (
    <div ref={containerRef} className={`space-y-2${open && filtered.length > 0 ? ' relative z-[100]' : ''}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-secondary placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-autocomplete="list"
          aria-expanded={open && filtered.length > 0}
        />
        {open && filtered.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-20 left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-card-hover max-h-52 overflow-y-auto"
          >
            {filtered.map((opt, i) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(opt.value);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                  i === activeIndex
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted'
                }`}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedLabels.map(({ value, label }) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
            >
              {label}
              <button
                type="button"
                onClick={() => remove(value)}
                aria-label={`Remove ${label}`}
                className="ml-0.5 hover:opacity-60 transition-opacity"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
