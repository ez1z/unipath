'use client';

import { useState, useRef } from 'react';

type Props = {
  name: string;
  defaultValue?: string[];
  placeholder?: string;
  disabled?: boolean;
  onChange?: (tags: string[]) => void;
};

export function TagInput({ name, defaultValue = [], placeholder, disabled, onChange }: Props) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const parts = raw.split(/[|,]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    let next = [...tags];
    for (const p of parts) {
      if (!next.includes(p)) next = [...next, p];
    }
    setTags(next);
    onChange?.(next);
    setInputValue('');
  }

  function removeTag(i: number) {
    const next = tags.filter((_, idx) => idx !== i);
    setTags(next);
    onChange?.(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length) {
      removeTag(tags.length - 1);
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={tags.join('|')} />
      <div
        onClick={() => !disabled && inputRef.current?.focus()}
        className="min-h-[42px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm flex flex-wrap gap-1.5 cursor-text focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition-shadow"
      >
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-foreground rounded-full text-xs font-medium"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removeTag(i); }}
                aria-label={`Remove ${tag}`}
                className="text-muted-foreground hover:text-red-500 transition-colors leading-none"
              >
                ×
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (inputValue.trim()) addTag(inputValue); }}
          placeholder={tags.length === 0 ? placeholder : undefined}
          disabled={disabled}
          aria-label="Add item"
          className="flex-1 min-w-[100px] outline-none bg-transparent placeholder:text-muted-foreground disabled:opacity-50 text-sm"
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Press Enter or comma to add · Backspace to remove last</p>
    </div>
  );
}
