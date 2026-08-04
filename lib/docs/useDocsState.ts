'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, removeDoc, toggleDoc } from './resolve';
import { createGuestDocsStore, createServerDocsStore, type DocsStore } from './store';
import {
  clearGuestDocs,
  hasLocalDocs,
  mergeDocs,
  readGuestDocs,
  writeGuestDocs,
} from './guest-store';
import { EMPTY_DIFF, type DocsDiff, type DocsDiffMap } from './types';

const SAVE_DEBOUNCE_MS = 600;

export type DocsSaveState = 'idle' | 'saving' | 'saved' | 'error';

type Options = {
  locale: string;
  isSignedIn: boolean;
  /** Server-fetched diffs. Guests get `{}` and are filled in after mount. */
  initial: DocsDiffMap;
};

/**
 * Document progress for any number of universities, shared by the list drawer
 * and the university page.
 *
 * Sign-in adoption lives here rather than beside the list's own adoption in
 * `useListState`, because documents are not list-scoped: a student who ticks
 * boxes on a university page and then signs in from that same page must keep
 * them, and that page never constructs a list.
 */
export function useDocsState({ locale, isSignedIn, initial }: Options) {
  const [diffs, setDiffs] = useState<DocsDiffMap>(initial);
  const [saveState, setSaveState] = useState<DocsSaveState>('idle');

  const store: DocsStore = useMemo(
    () => (isSignedIn ? createServerDocsStore(locale) : createGuestDocsStore()),
    [isSignedIn, locale],
  );

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const hydrated = useRef(false);

  /**
   * localStorage is invisible to the server, so guest progress is read after
   * mount rather than during render — otherwise the first paint would disagree
   * with the server HTML.
   *
   * For a signed-in student this is the one moment local progress is adopted.
   * Every locally-stored university is imported, not just the ones on screen,
   * because this may be running on a university page that fetched exactly one.
   * The import ignores conflicts, so the account's own progress always wins.
   */
  useEffect(() => {
    const local = readGuestDocs();

    if (!isSignedIn) {
      if (hasLocalDocs(local)) setDiffs(local);
      hydrated.current = true;
      return;
    }

    hydrated.current = true;
    if (!hasLocalDocs(local)) return;

    const merged = mergeDocs(local, initial);
    setDiffs(merged);
    setSaveState('saving');

    store
      .importAll(merged)
      .then(() => {
        clearGuestDocs();
        setSaveState('saved');
      })
      .catch(() => setSaveState('error'));
    // Deliberately keyed on session state alone: `initial` is this render's
    // server snapshot, and re-running adoption when it changes would re-import
    // progress that was already merged.
  }, [isSignedIn, locale]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const persist = useCallback(
    (universityId: string, diff: DocsDiff) => {
      // Guests write straight through: localStorage is synchronous and cheap,
      // and debouncing it would lose a tick made just before navigating away.
      if (!isSignedIn) {
        void store.setDocs(universityId, diff);
        return;
      }

      const existing = timers.current.get(universityId);
      if (existing) clearTimeout(existing);

      setSaveState('saving');
      const timer = setTimeout(() => {
        timers.current.delete(universityId);
        store
          .setDocs(universityId, diff)
          .then(() => setSaveState('saved'))
          .catch(() => setSaveState('error'));
      }, SAVE_DEBOUNCE_MS);

      timers.current.set(universityId, timer);
    },
    [store, isSignedIn],
  );

  // Reads `diffs` from the closure rather than using a functional update: each
  // change has to persist as well as update, and a state updater that fires a
  // network call is impure — React may run it twice.
  const mutate = useCallback(
    (universityId: string, fn: (diff: DocsDiff) => DocsDiff) => {
      const current = diffs[universityId] ?? EMPTY_DIFF;
      const next = fn(current);
      if (next === current) return;

      setDiffs({ ...diffs, [universityId]: next });
      persist(universityId, next);
    },
    [diffs, persist],
  );

  const toggle = useCallback(
    (universityId: string, itemId: string, checked: boolean) =>
      mutate(universityId, (d) => toggleDoc(d, itemId, checked)),
    [mutate],
  );

  const add = useCallback(
    (universityId: string, name: string) => mutate(universityId, (d) => addDoc(d, name)),
    [mutate],
  );

  const remove = useCallback(
    (universityId: string, itemId: string) => mutate(universityId, (d) => removeDoc(d, itemId)),
    [mutate],
  );

  const diffOf = useCallback(
    (universityId: string): DocsDiff => diffs[universityId] ?? EMPTY_DIFF,
    [diffs],
  );

  /**
   * The `hydrated` guard is load-bearing: on mount this would otherwise run
   * with the empty server snapshot and overwrite the very progress the effect
   * above is in the middle of reading back.
   */
  useEffect(() => {
    if (isSignedIn || !hydrated.current) return;
    writeGuestDocs(diffs);
  }, [isSignedIn, diffs]);

  return { diffs, diffOf, toggle, add, remove, saveState };
}
