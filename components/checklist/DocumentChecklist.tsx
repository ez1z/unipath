'use client';

import { useState, useTransition, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { ChecklistItem } from '@/lib/data/checklist-types';
import {
  toggleChecklistItem,
  addChecklistItem,
  deleteChecklistItem,
} from '@/lib/actions/checklist';

type Props = {
  universityId: string;
  initialItems: ChecklistItem[];
};

export function DocumentChecklist({ universityId, initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations('checklist');

  const total = items.length;
  const checked = items.filter((i) => i.is_checked).length;
  const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

  function handleToggle(item: ChecklistItem) {
    const next = !item.is_checked;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_checked: next } : i)),
    );
    startTransition(async () => {
      const res = await toggleChecklistItem(item.id, next);
      if (!res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, is_checked: item.is_checked } : i,
          ),
        );
      }
    });
  }

  function handleDelete(itemId: string) {
    const removed = items.find((i) => i.id === itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    startTransition(async () => {
      const res = await deleteChecklistItem(itemId);
      if (!res.ok && removed) {
        setItems((prev) =>
          [...prev, removed].sort((a, b) => a.sort_order - b.sort_order),
        );
      }
    });
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await addChecklistItem(universityId, name);
      if ('item' in res) {
        setItems((prev) => [...prev, res.item]);
        setNewName('');
        setShowAdd(false);
      }
    });
  }

  function openAdd() {
    setShowAdd(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      {/* Header + progress count */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold text-base text-foreground">
          {t('title')}
        </h3>
        <span className="text-sm text-muted-foreground tabular-nums">
          {t('progress', { checked, total })}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full bg-secondary rounded-full h-2 mb-5"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('progress', { checked, total })}
      >
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            pct === 100 ? 'bg-tk-green' : 'bg-primary'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Checklist items */}
      <ul className="space-y-2 mb-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 group">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.is_checked}
              aria-label={item.name}
              onClick={() => handleToggle(item)}
              disabled={isPending}
              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors disabled:opacity-50 ${
                item.is_checked
                  ? 'bg-tk-green border-tk-green text-white'
                  : 'border-border hover:border-tk-green'
              }`}
            >
              {item.is_checked && (
                <svg
                  width="10"
                  height="8"
                  viewBox="0 0 10 8"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M1 4L3.5 6.5L9 1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <span
              className={`flex-1 text-sm ${
                item.is_checked
                  ? 'line-through text-muted-foreground'
                  : 'text-foreground'
              }`}
            >
              {item.name}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              disabled={isPending}
              aria-label={t('delete_item')}
              className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 text-muted-foreground hover:text-destructive transition-all disabled:opacity-30"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      {/* Add item */}
      {showAdd ? (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('add_placeholder')}
            maxLength={120}
            disabled={isPending}
            className="flex-1 text-sm px-3 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
            aria-label={t('add_placeholder')}
          />
          <button
            type="submit"
            disabled={isPending || !newName.trim()}
            className="text-sm px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 font-medium"
          >
            {t('add_button')}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAdd(false);
              setNewName('');
            }}
            className="text-sm px-2 py-1.5 text-muted-foreground hover:text-foreground"
            aria-label={t('cancel')}
          >
            ✕
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={openAdd}
          className="text-sm text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t('add_item')}
        </button>
      )}
    </div>
  );
}
