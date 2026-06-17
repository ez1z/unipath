'use client';

import { useState, useTransition, useMemo } from 'react';
import type { DbUniversity } from './MoeUniversityList';
import { linkMoeUniversityAction } from '@/app/admin/universities/actions';

type Props = {
  moeEntryName: string;
  allDbUniversities: DbUniversity[];
  onClose: () => void;
  onSuccess: () => void;
};

export function LinkUniversityDialog({ moeEntryName, allDbUniversities, onClose, onSuccess }: Props) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (!search.trim()) return allDbUniversities;
    const q = search.toLowerCase();
    return allDbUniversities.filter((u) => u.name_en.toLowerCase().includes(q));
  }, [search, allDbUniversities]);

  function handleConfirm() {
    if (!selectedId) return;
    setError(null);
    startTransition(async () => {
      const result = await linkMoeUniversityAction(selectedId);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error ?? 'Something went wrong.');
      }
    });
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={`Link ${moeEntryName} to UniPath`}
      onClick={handleBackdropClick}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold text-base">Link to UniPath</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Which university in UniPath is{' '}
            <span className="font-medium text-foreground">"{moeEntryName}"</span>?
          </p>
        </div>

        <div className="p-4 border-b border-border">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search universities…"
            aria-label="Search universities"
            autoFocus
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <ul className="overflow-y-auto flex-1 p-2 space-y-0.5">
          {filtered.length === 0 ? (
            <li className="text-sm text-muted-foreground text-center py-8">No universities found.</li>
          ) : (
            filtered.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(u.id)}
                  aria-pressed={selectedId === u.id}
                  className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    selectedId === u.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  {u.name_en}
                </button>
              </li>
            ))
          )}
        </ul>

        {error && (
          <p className="px-5 pb-2 text-sm text-destructive">{error}</p>
        )}

        <div className="p-4 border-t border-border flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedId || isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
