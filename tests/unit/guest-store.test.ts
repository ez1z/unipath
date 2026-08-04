import { describe, it, expect } from 'vitest';
import {
  mergeLists,
  parseGuestList,
  hasLocalData,
  type ListState,
} from '@/lib/list/guest-store';
import {
  normalizeColumns,
  newEntry,
  MAX_CUSTOM_COLUMNS,
  type ColumnDef,
  type ListEntry,
} from '@/lib/data/list-types';
import { DEFAULT_VIEW, type ListView } from '@/lib/list/view';

// Real v4 UUIDs: the entry schema validates the version/variant bits, exactly
// as it will against ids that Postgres' gen_random_uuid() produced.
const UNI_A = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const UNI_B = '5c1e9a72-8b30-4d6e-9f21-77a1b4c5d6e2';
const UNI_C = '9d7b1c34-2a56-4e8f-8c03-1b2d3e4f5a60';

const custom = (id: string, name = id): ColumnDef => ({ id, kind: 'custom', name, type: 'text' });

function state(
  entries: ListEntry[],
  columns: ColumnDef[] = [],
  view: ListView = DEFAULT_VIEW,
): ListState {
  return { entries, columns: normalizeColumns(columns), view };
}

describe('parseGuestList', () => {
  it('returns an empty list for missing storage', () => {
    const result = parseGuestList(null);
    expect(result.entries).toEqual([]);
    expect(result.columns.length).toBeGreaterThan(0);
  });

  it('returns an empty list rather than throwing on corrupt JSON', () => {
    expect(parseGuestList('{not json').entries).toEqual([]);
  });

  it('drops entries that fail validation instead of rejecting the whole blob', () => {
    const raw = JSON.stringify({ entries: [{ university_id: 'not-a-uuid' }], columns: [] });
    expect(parseGuestList(raw).entries).toEqual([]);
  });

  it('reads back a list it could have written', () => {
    const raw = JSON.stringify({ entries: [newEntry(UNI_A, 0)], columns: [] });
    expect(parseGuestList(raw).entries).toHaveLength(1);
    expect(parseGuestList(raw).entries[0].university_id).toBe(UNI_A);
  });
});

describe('hasLocalData', () => {
  it('is false for a fresh default list', () => {
    expect(hasLocalData(state([]))).toBe(false);
  });

  it('is true when there are entries', () => {
    expect(hasLocalData(state([newEntry(UNI_A, 0)]))).toBe(true);
  });

  it('is true when the guest defined a custom column but added no rows', () => {
    expect(hasLocalData(state([], [custom('c1')]))).toBe(true);
  });
});

describe('mergeLists — the account wins', () => {
  it('keeps the server version of a university present in both', () => {
    const local = state([{ ...newEntry(UNI_A, 0), notes: 'local note' }]);
    const server = state([{ ...newEntry(UNI_A, 0), notes: 'server note' }]);

    const merged = mergeLists(local, server);
    expect(merged.entries).toHaveLength(1);
    expect(merged.entries[0].notes).toBe('server note');
  });

  it('adopts local-only rows', () => {
    const local = state([newEntry(UNI_A, 0), newEntry(UNI_B, 1)]);
    const server = state([newEntry(UNI_A, 0)]);

    const ids = mergeLists(local, server).entries.map((e) => e.university_id);
    expect(ids).toEqual([UNI_A, UNI_B]);
  });

  it('places adopted rows after the account rows', () => {
    const local = state([newEntry(UNI_C, 0)]);
    const server = state([newEntry(UNI_A, 0), newEntry(UNI_B, 1)]);

    expect(mergeLists(local, server).entries.map((e) => e.university_id)).toEqual([
      UNI_A,
      UNI_B,
      UNI_C,
    ]);
  });

  it('renumbers sort_order so positions stay contiguous', () => {
    const local = state([{ ...newEntry(UNI_C, 99), sort_order: 99 }]);
    const server = state([newEntry(UNI_A, 0)]);

    expect(mergeLists(local, server).entries.map((e) => e.sort_order)).toEqual([0, 1]);
  });

  it('is a no-op when the guest has nothing', () => {
    const server = state([newEntry(UNI_A, 0)]);
    expect(mergeLists(state([]), server).entries).toHaveLength(1);
  });
});

describe('mergeLists — columns', () => {
  it('adopts local custom columns the account does not have', () => {
    const local = state([], [custom('c1', 'Agent fee')]);
    const server = state([]);

    const ids = mergeLists(local, server).columns.map((c) => c.id);
    expect(ids).toContain('c1');
  });

  it('does not duplicate a custom column that exists in both', () => {
    const local = state([], [custom('c1', 'Local name')]);
    const server = state([], [custom('c1', 'Server name')]);

    const matches = mergeLists(local, server).columns.filter((c) => c.id === 'c1');
    expect(matches).toHaveLength(1);
    expect(matches[0].kind === 'custom' && matches[0].name).toBe('Server name');
  });

  it('never pushes the account past the custom column cap', () => {
    const serverColumns = Array.from({ length: MAX_CUSTOM_COLUMNS }, (_, i) => custom(`s${i}`));
    const local = state([], [custom('extra')]);
    const server = state([], serverColumns);

    const merged = mergeLists(local, server);
    expect(merged.columns.filter((c) => c.kind === 'custom')).toHaveLength(MAX_CUSTOM_COLUMNS);
    expect(merged.columns.map((c) => c.id)).not.toContain('extra');
  });
});

describe('mergeLists — sort preference', () => {
  const byDeadline: ListView = { sort: { columnId: 'deadline', dir: 'asc' } };
  const byTuition: ListView = { sort: { columnId: 'tuition', dir: 'desc' } };

  it('keeps the account sort when it has one', () => {
    expect(mergeLists(state([], [], byDeadline), state([], [], byTuition)).view).toEqual(byTuition);
  });

  it('adopts the guest sort only when the account has none', () => {
    expect(mergeLists(state([], [], byDeadline), state([])).view).toEqual(byDeadline);
  });
});

describe('parseGuestList — view', () => {
  it('falls back to manual order when the stored sort names an unknown column', () => {
    const raw = JSON.stringify({ entries: [], columns: [], view: { sort: { columnId: 'gone', dir: 'asc' } } });
    expect(parseGuestList(raw).view.sort).toBeNull();
  });

  it('round-trips a valid sort', () => {
    const raw = JSON.stringify({ entries: [], columns: [], view: { sort: { columnId: 'docs', dir: 'desc' } } });
    expect(parseGuestList(raw).view.sort).toEqual({ columnId: 'docs', dir: 'desc' });
  });
});
