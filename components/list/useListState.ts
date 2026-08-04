'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_ENTRIES,
  newEntry,
  normalizeColumns,
  type ColumnDef,
  type ListEntry,
} from '@/lib/data/list-types';
import { createGuestStore, createServerStore, type ListStore } from '@/lib/list/store';
import {
  clearGuestList,
  hasLocalData,
  mergeLists,
  readGuestList,
  writeGuestList,
} from '@/lib/list/guest-store';
import { importEntriesAction } from '@/lib/actions/list';
import { normalizeView, type ListView } from '@/lib/list/view';

const SAVE_DEBOUNCE_MS = 600;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type Options = {
  locale: string;
  isSignedIn: boolean;
  initialEntries: ListEntry[];
  initialColumns: ColumnDef[];
  initialView: ListView;
};

export function useListState({
  locale,
  isSignedIn,
  initialEntries,
  initialColumns,
  initialView,
}: Options) {
  const [entries, setEntries] = useState<ListEntry[]>(initialEntries);
  const [columns, setColumns] = useState<ColumnDef[]>(initialColumns);
  const [view, setView] = useState<ListView>(initialView);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [limitReached, setLimitReached] = useState(false);

  const store: ListStore = useMemo(
    () => (isSignedIn ? createServerStore(locale) : createGuestStore()),
    [isSignedIn, locale],
  );

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const hydrated = useRef(false);

  /**
   * Guest state lives in localStorage, which the server cannot see, so it is
   * read after mount rather than during render — otherwise the first paint
   * would disagree with the server HTML.
   *
   * When a signed-in user arrives carrying local rows, this is the one moment
   * those rows get adopted into the account: merge, push, then clear, so the
   * browser copy can never resurrect itself later.
   */
  useEffect(() => {
    const local = readGuestList();

    if (!isSignedIn) {
      if (hasLocalData(local)) {
        setEntries(local.entries);
        setColumns(local.columns);
        setView(local.view);
      }
      hydrated.current = true;
      return;
    }

    hydrated.current = true;
    if (!hasLocalData(local)) return;

    const merged = mergeLists(local, {
      entries: initialEntries,
      columns: initialColumns,
      view: initialView,
    });
    setEntries(merged.entries);
    setColumns(merged.columns);
    setView(merged.view);
    setSaveState('saving');

    importEntriesAction(locale, merged.entries, merged.columns, merged.view).then((result) => {
      if (result.ok) {
        clearGuestList();
        setSaveState('saved');
      } else {
        setSaveState('error');
      }
    });
    // Deliberately keyed on session state alone: initialEntries/initialColumns
    // are this render's server snapshot, and re-running the adoption when they
    // change would re-import rows that were already merged.
  }, [isSignedIn, locale]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const persist = useCallback(
    (entry: ListEntry) => {
      const existing = timers.current.get(entry.university_id);
      if (existing) clearTimeout(existing);

      setSaveState('saving');
      const timer = setTimeout(() => {
        timers.current.delete(entry.university_id);
        store
          .upsert(entry)
          .then(() => setSaveState('saved'))
          .catch(() => setSaveState('error'));
      }, SAVE_DEBOUNCE_MS);

      timers.current.set(entry.university_id, timer);
    },
    [store],
  );

  // These read `entries` from the closure rather than using functional updates:
  // each one has to persist as well as update, and a state updater that fires a
  // network call is impure — React may run it twice, and it cannot legally call
  // another setState (the limit warning) from inside.
  const addEntry = useCallback(
    (universityId: string) => {
      if (entries.some((e) => e.university_id === universityId)) return;
      if (entries.length >= MAX_ENTRIES) {
        setLimitReached(true);
        return;
      }
      setLimitReached(false);
      const entry = newEntry(universityId, entries.length);
      setEntries([...entries, entry]);
      persist(entry);
    },
    [entries, persist],
  );

  const updateEntry = useCallback(
    (universityId: string, patch: Partial<ListEntry>) => {
      const current = entries.find((e) => e.university_id === universityId);
      if (!current) return;
      const next = { ...current, ...patch };
      setEntries(entries.map((e) => (e.university_id === universityId ? next : e)));
      persist(next);
    },
    [entries, persist],
  );

  const removeEntry = useCallback(
    (universityId: string) => {
      const timer = timers.current.get(universityId);
      if (timer) {
        clearTimeout(timer);
        timers.current.delete(universityId);
      }
      setLimitReached(false);
      setEntries((prev) => prev.filter((e) => e.university_id !== universityId));
      setSaveState('saving');
      store
        .remove(universityId)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    },
    [store],
  );

  const reorderRows = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= entries.length ||
        toIndex >= entries.length
      ) {
        return;
      }

      const next = [...entries];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      const ordered = next.map((e, i) => ({ ...e, sort_order: i }));

      setEntries(ordered);
      setSaveState('saving');
      store
        .reorder(ordered.map((e) => e.university_id))
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    },
    [entries, store],
  );

  const updateColumns = useCallback(
    (next: ColumnDef[]) => {
      const normalized = normalizeColumns(next);
      setColumns(normalized);
      setSaveState('saving');
      store
        .setColumns(normalized)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    },
    [store],
  );

  const updateView = useCallback(
    (next: ListView) => {
      const normalized = normalizeView(next);
      setView(normalized);
      setSaveState('saving');
      store
        .setView(normalized)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    },
    [store],
  );

  /**
   * Guests get no server round-trip, so mirror every change straight to storage.
   *
   * The `hydrated` guard is load-bearing: on mount this effect would otherwise
   * run with the empty server snapshot and overwrite the very list the effect
   * above is in the middle of reading back.
   */
  useEffect(() => {
    if (isSignedIn || !hydrated.current) return;
    writeGuestList({ entries, columns, view });
  }, [isSignedIn, entries, columns, view]);

  return {
    entries,
    columns,
    view,
    saveState,
    limitReached,
    addEntry,
    updateEntry,
    removeEntry,
    reorderRows,
    updateColumns,
    updateView,
  };
}
