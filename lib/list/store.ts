import type { ColumnDef, ListEntry } from '@/lib/data/list-types';
import {
  readGuestList,
  writeGuestList,
  type ListState,
} from '@/lib/list/guest-store';
import type { ListView } from '@/lib/list/view';
import {
  upsertEntryAction,
  removeEntryAction,
  reorderEntriesAction,
  setColumnsAction,
  setViewAction,
  type ListActionResult,
} from '@/lib/actions/list';

/**
 * The list page talks to one of these and never learns which. Signed-in users
 * hit server actions; guests hit localStorage. Everything above this line —
 * autosave, reordering, the column manager — is written once.
 */
export type ListStore = {
  upsert(entry: ListEntry): Promise<void>;
  remove(universityId: string): Promise<void>;
  reorder(universityIdsInOrder: string[]): Promise<void>;
  setColumns(columns: ColumnDef[]): Promise<void>;
  setView(view: ListView): Promise<void>;
};

/**
 * Server actions report failure by returning `{ ok: false }` rather than
 * throwing, so every one of these has to check. Awaiting without checking made
 * a rejected write look like a successful one, and the save indicator said
 * "Saved" over an edit that never left the browser.
 */
function assertSaved(result: ListActionResult): void {
  if (!result.ok) throw new Error(result.error);
}

export function createServerStore(locale: string): ListStore {
  return {
    async upsert(entry) {
      assertSaved(await upsertEntryAction(locale, entry));
    },
    async remove(universityId) {
      assertSaved(await removeEntryAction(locale, universityId));
    },
    async reorder(ids) {
      assertSaved(await reorderEntriesAction(locale, ids));
    },
    async setColumns(columns) {
      assertSaved(await setColumnsAction(locale, columns));
    },
    async setView(view) {
      assertSaved(await setViewAction(locale, view));
    },
  };
}

export function createGuestStore(): ListStore {
  const update = (fn: (state: ListState) => ListState) => {
    writeGuestList(fn(readGuestList()));
  };

  return {
    async upsert(entry) {
      update((s) => {
        const rest = s.entries.filter((e) => e.university_id !== entry.university_id);
        return { ...s, entries: [...rest, entry].sort((a, b) => a.sort_order - b.sort_order) };
      });
    },
    async remove(universityId) {
      update((s) => ({
        ...s,
        entries: s.entries.filter((e) => e.university_id !== universityId),
      }));
    },
    async reorder(ids) {
      update((s) => {
        const position = new Map(ids.map((id, i) => [id, i]));
        return {
          ...s,
          entries: s.entries
            .map((e) => ({ ...e, sort_order: position.get(e.university_id) ?? e.sort_order }))
            .sort((a, b) => a.sort_order - b.sort_order),
        };
      });
    },
    async setColumns(columns) {
      update((s) => ({ ...s, columns }));
    },
    async setView(view) {
      update((s) => ({ ...s, view }));
    },
  };
}
