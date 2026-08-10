import { describe, it, expect } from 'vitest';
import {
  normalizeColumns,
  visibleColumns,
  DEFAULT_COLUMNS,
  FIXED_COLUMN_IDS,
  PINNED_COLUMN_ID,
  MAX_CUSTOM_COLUMNS,
  DEFAULT_HIDDEN_COLUMNS,
  type ColumnDef,
} from '@/lib/data/list-types';

const custom = (id: string, name = id): ColumnDef => ({
  id,
  kind: 'custom',
  name,
  type: 'text',
});

describe('normalizeColumns — empty and invalid input', () => {
  it('falls back to the default layout when nothing is stored', () => {
    expect(normalizeColumns([]).map((c) => c.id)).toEqual(DEFAULT_COLUMNS.map((c) => c.id));
  });

  it('falls back to the default layout when the stored value is not a layout', () => {
    expect(normalizeColumns('nonsense').map((c) => c.id)).toEqual(
      DEFAULT_COLUMNS.map((c) => c.id),
    );
    expect(normalizeColumns(null)).toHaveLength(FIXED_COLUMN_IDS.length);
  });
});

describe('normalizeColumns — default visibility', () => {
  it('starts with every column visible', () => {
    const visible = visibleColumns(normalizeColumns([]));
    expect(visible).toHaveLength(FIXED_COLUMN_IDS.length);
    expect(visible.map((c) => c.id)).toContain('net_cost');
    expect(visible.map((c) => c.id)).toContain('flags');
  });

  it('hides exactly the columns marked as hidden by default', () => {
    const hidden = normalizeColumns([])
      .filter((c) => c.hidden)
      .map((c) => c.id);
    expect(new Set(hidden)).toEqual(DEFAULT_HIDDEN_COLUMNS);
  });

  it('respects a user who explicitly hid a column', () => {
    const stored: ColumnDef[] = [
      { id: PINNED_COLUMN_ID, kind: 'fixed' },
      { id: 'flags', kind: 'fixed', hidden: true },
    ];
    const flags = normalizeColumns(stored).find((c) => c.id === 'flags');
    expect(flags?.hidden).toBe(true);
  });

  /** A column added after a layout was saved still follows the default. */
  it('gives a newly introduced column the default visibility', () => {
    const stored: ColumnDef[] = [{ id: PINNED_COLUMN_ID, kind: 'fixed' }];
    const appended = normalizeColumns(stored).filter((c) => c.id !== PINNED_COLUMN_ID);
    expect(appended.every((c) => c.hidden === DEFAULT_HIDDEN_COLUMNS.has(c.id as never))).toBe(true);
  });
});

describe('normalizeColumns — surviving schema drift', () => {
  it('drops fixed columns that no longer exist', () => {
    const stored = [{ id: 'retired_column', kind: 'fixed' }, ...DEFAULT_COLUMNS];
    expect(normalizeColumns(stored).map((c) => c.id)).not.toContain('retired_column');
  });

  it('appends fixed columns added since the layout was saved', () => {
    const stored: ColumnDef[] = [
      { id: PINNED_COLUMN_ID, kind: 'fixed' },
      { id: 'tier', kind: 'fixed' },
    ];
    const result = normalizeColumns(stored);
    expect(result).toHaveLength(FIXED_COLUMN_IDS.length);
    expect(result[0].id).toBe(PINNED_COLUMN_ID);
    expect(result[1].id).toBe('tier');
    expect(result.map((c) => c.id)).toContain('notes');
  });

  it('preserves the user ordering of the columns it kept', () => {
    const stored: ColumnDef[] = [
      { id: PINNED_COLUMN_ID, kind: 'fixed' },
      { id: 'notes', kind: 'fixed' },
      { id: 'tier', kind: 'fixed' },
    ];
    const ids = normalizeColumns(stored).map((c) => c.id);
    expect(ids.indexOf('notes')).toBeLessThan(ids.indexOf('tier'));
  });

  it('drops duplicate ids, keeping the first occurrence', () => {
    const stored: ColumnDef[] = [
      { id: PINNED_COLUMN_ID, kind: 'fixed' },
      { id: 'tier', kind: 'fixed', hidden: true },
      { id: 'tier', kind: 'fixed' },
    ];
    const tiers = normalizeColumns(stored).filter((c) => c.id === 'tier');
    expect(tiers).toHaveLength(1);
    expect(tiers[0].hidden).toBe(true);
  });
});

describe('normalizeColumns — the pinned identity column', () => {
  it('moves the university column to the front wherever it was stored', () => {
    const stored: ColumnDef[] = [
      { id: 'tier', kind: 'fixed' },
      { id: PINNED_COLUMN_ID, kind: 'fixed' },
    ];
    expect(normalizeColumns(stored)[0].id).toBe(PINNED_COLUMN_ID);
  });

  it('refuses to hide the university column', () => {
    const stored: ColumnDef[] = [{ id: PINNED_COLUMN_ID, kind: 'fixed', hidden: true }];
    expect(normalizeColumns(stored)[0].hidden).toBe(false);
  });

  it('adds the university column when a stored layout omits it entirely', () => {
    const stored: ColumnDef[] = [{ id: 'tier', kind: 'fixed' }];
    expect(normalizeColumns(stored)[0].id).toBe(PINNED_COLUMN_ID);
  });
});

describe('normalizeColumns — custom columns', () => {
  it('keeps custom columns and their position', () => {
    const stored: ColumnDef[] = [
      { id: PINNED_COLUMN_ID, kind: 'fixed' },
      custom('c1', 'Agent fee'),
      { id: 'tier', kind: 'fixed' },
    ];
    const ids = normalizeColumns(stored).map((c) => c.id);
    expect(ids.indexOf('c1')).toBe(1);
  });

  it('caps the number of custom columns', () => {
    const many = Array.from({ length: MAX_CUSTOM_COLUMNS + 5 }, (_, i) => custom(`c${i}`));
    const result = normalizeColumns([{ id: PINNED_COLUMN_ID, kind: 'fixed' }, ...many]);
    expect(result.filter((c) => c.kind === 'custom')).toHaveLength(MAX_CUSTOM_COLUMNS);
  });

  it('rejects a custom column missing its name', () => {
    const stored = [{ id: 'c1', kind: 'custom', type: 'text' }];
    expect(normalizeColumns(stored).map((c) => c.id)).not.toContain('c1');
  });
});

describe('visibleColumns', () => {
  it('filters out hidden columns', () => {
    const cols: ColumnDef[] = [
      { id: PINNED_COLUMN_ID, kind: 'fixed' },
      { id: 'tier', kind: 'fixed', hidden: true },
      { id: 'status', kind: 'fixed' },
    ];
    expect(visibleColumns(cols).map((c) => c.id)).toEqual([PINNED_COLUMN_ID, 'status']);
  });
});
