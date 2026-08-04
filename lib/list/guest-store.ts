import {
  ListEntriesSchema,
  ColumnLayoutSchema,
  normalizeColumns,
  MAX_ENTRIES,
  MAX_CUSTOM_COLUMNS,
  type ColumnDef,
  type ListEntry,
} from '@/lib/data/list-types';
import { normalizeView, ListViewSchema, DEFAULT_VIEW, type ListView } from '@/lib/list/view';

export const GUEST_STORAGE_KEY = 'unipath:list:v1';

export type ListState = { entries: ListEntry[]; columns: ColumnDef[]; view: ListView };

/** A function, not a constant: callers own the arrays they get back. */
export function emptyListState(): ListState {
  return { entries: [], columns: normalizeColumns([]), view: DEFAULT_VIEW };
}

/* ------------------------------------------------------------------ *
 * Pure logic — no browser APIs, so it is testable in a node environment
 * ------------------------------------------------------------------ */

export function parseGuestList(raw: string | null): ListState {
  if (!raw) return emptyListState();

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return emptyListState();
  }

  const blob = (json ?? {}) as { entries?: unknown; columns?: unknown; view?: unknown };
  const entries = ListEntriesSchema.safeParse(blob.entries).data ?? [];

  return {
    entries,
    columns: normalizeColumns(blob.columns),
    view: normalizeView(blob.view),
  };
}

/**
 * Fold a guest's local list into the account they just signed into.
 *
 * The account is authoritative: anything already saved server-side is real,
 * deliberate data, while the local copy may be weeks-old scratch work from a
 * shared browser. So server rows win on conflict and local-only rows are
 * adopted — a merge that can add but never overwrite.
 */
export function mergeLists(local: ListState, server: ListState): ListState {
  const serverIds = new Set(server.entries.map((e) => e.university_id));

  const adopted = local.entries.filter((e) => !serverIds.has(e.university_id));
  const entries = [...server.entries, ...adopted]
    .slice(0, MAX_ENTRIES)
    .map((e, i) => ({ ...e, sort_order: i }));

  const columnIds = new Set(server.columns.map((c) => c.id));
  const customCount = server.columns.filter((c) => c.kind === 'custom').length;
  const room = Math.max(0, MAX_CUSTOM_COLUMNS - customCount);

  const adoptedColumns = local.columns
    .filter((c) => c.kind === 'custom' && !columnIds.has(c.id))
    .slice(0, room);

  return {
    entries,
    columns: normalizeColumns([...server.columns, ...adoptedColumns]),
    // Same rule for the sort preference: the account's choice stands, and the
    // guest's is adopted only into the gap where the account has none.
    view: server.view.sort ? server.view : local.view,
  };
}

export function hasLocalData(state: ListState): boolean {
  return (
    state.entries.length > 0 ||
    state.columns.some((c) => c.kind === 'custom') ||
    state.view.sort !== null
  );
}

/* ------------------------------------------------------------------ *
 * localStorage wrapper
 * ------------------------------------------------------------------ */

export function readGuestList(): ListState {
  if (typeof window === 'undefined') return emptyListState();
  try {
    return parseGuestList(window.localStorage.getItem(GUEST_STORAGE_KEY));
  } catch {
    // Private mode and blocked-storage settings throw on access rather than
    // returning null; an empty list is a better outcome than a broken page.
    return emptyListState();
  }
}

export function writeGuestList(state: ListState): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      entries: ListEntriesSchema.parse(state.entries),
      columns: ColumnLayoutSchema.parse(state.columns),
      view: ListViewSchema.parse(state.view),
    };
    window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable or quota exceeded — the in-memory list still works */
  }
}

export function clearGuestList(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GUEST_STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}
