import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  applyView,
  activeFilterCount,
  isSortable,
  normalizeView,
  DEFAULT_VIEW,
  EMPTY_FILTERS,
  type ListFilters,
  type ListView,
  type SortableColumnId,
} from '@/lib/list/view';
import { buildRow, type ListRow } from '@/lib/list/row-view';
import { newEntry, type Status, type Tier } from '@/lib/data/list-types';
import type { University } from '@/lib/data/university-types';
import type { Semester } from '@/lib/types/semester';

const TODAY = new Date('2026-08-05T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

let idCounter = 0;
const nextId = () => `3f2504e0-4f89-41d3-9a0c-0305e82c${String(++idCounter).padStart(4, '0')}`;

type UniOver = Partial<Pick<
  University,
  'country' | 'city' | 'tuition_usd' | 'moe_approved' | 'ranking_qs' | 'acceptance_rate_min' | 'semesters'
>> & { name?: string };

function uni(over: UniOver = {}): University {
  const label = over.name ?? 'Test University';
  return {
    id: nextId(),
    slug: 'test',
    name: { en: label, ru: label, tk: label },
    country: over.country ?? 'Turkey',
    city: over.city ?? 'Ankara',
    tuition_usd: over.tuition_usd ?? 10_000,
    tuition_usd_max: null,
    acceptance_rate_min: over.acceptance_rate_min ?? null,
    acceptance_rate_max: null,
    moe_approved: over.moe_approved ?? false,
    ranking_qs: over.ranking_qs ?? null,
    languages: [],
    majors: [],
    official_website: '',
    application_portal_url: '',
    entrance_requirements: {},
    semesters: over.semesters ?? [],
    tuition_options: [],
  };
}

const semester = (name: string, deadline: string | null): Semester => ({
  name,
  start_date: '2026-09-15',
  deadline,
  language: null,
  major: null,
});

type RowOver = {
  tier?: Tier | null;
  status?: Status;
  fitTier?: Tier | null;
  docs?: { total: number; checked: number };
};

function row(university: University, over: RowOver = {}): ListRow {
  const entry = {
    ...newEntry(university.id, 0),
    tier: over.tier ?? null,
    status: over.status ?? 'planning',
  };
  return buildRow(
    entry,
    university,
    { tier: over.fitTier ?? null, flags: [] },
    over.docs,
    new Map(),
  );
}

const filters = (over: Partial<ListFilters> = {}): ListFilters => ({ ...EMPTY_FILTERS, ...over });
const sortBy = (columnId: SortableColumnId, dir: 'asc' | 'desc' = 'asc'): ListView => ({
  sort: { columnId, dir },
});

const names = (rows: ListRow[]) => rows.map((r) => r.university.name.en);

describe('isSortable', () => {
  it('accepts columns with a meaningful order', () => {
    expect(isSortable('deadline')).toBe(true);
    expect(isSortable('tuition')).toBe(true);
  });

  it('rejects columns nobody would agree how to order', () => {
    expect(isSortable('scholarships')).toBe(false);
    expect(isSortable('flags')).toBe(false);
    expect(isSortable('notes')).toBe(false);
  });
});

describe('normalizeView', () => {
  it('degrades a sort naming a removed column to manual order', () => {
    expect(normalizeView({ sort: { columnId: 'retired_column', dir: 'asc' } })).toEqual(DEFAULT_VIEW);
  });

  it('degrades junk to manual order rather than throwing', () => {
    expect(normalizeView('nonsense')).toEqual(DEFAULT_VIEW);
    expect(normalizeView(null)).toEqual(DEFAULT_VIEW);
  });

  it('keeps a valid sort', () => {
    const view = sortBy('tuition', 'desc');
    expect(normalizeView(view)).toEqual(view);
  });
});

describe('applyView — manual order', () => {
  it('leaves rows exactly as given', () => {
    const rows = [row(uni({ name: 'Zed' })), row(uni({ name: 'Alpha' }))];
    expect(names(applyView(rows, DEFAULT_VIEW, EMPTY_FILTERS, 'en'))).toEqual(['Zed', 'Alpha']);
  });

  it('never mutates the input array, so “My order” is always recoverable', () => {
    const rows = [row(uni({ name: 'Zed' })), row(uni({ name: 'Alpha' }))];
    applyView(rows, sortBy('university'), EMPTY_FILTERS, 'en');
    expect(names(rows)).toEqual(['Zed', 'Alpha']);
  });
});

describe('applyView — sorting', () => {
  it('sorts by name in both directions', () => {
    const rows = [row(uni({ name: 'Bilkent' })), row(uni({ name: 'Ankara' }))];
    expect(names(applyView(rows, sortBy('university'), EMPTY_FILTERS, 'en'))).toEqual([
      'Ankara',
      'Bilkent',
    ]);
    expect(names(applyView(rows, sortBy('university', 'desc'), EMPTY_FILTERS, 'en'))).toEqual([
      'Bilkent',
      'Ankara',
    ]);
  });

  it('sorts tuition numerically', () => {
    const rows = [
      row(uni({ name: 'Dear', tuition_usd: 90_000 })),
      row(uni({ name: 'Cheap', tuition_usd: 1_500 })),
    ];
    expect(names(applyView(rows, sortBy('tuition'), EMPTY_FILTERS, 'en'))).toEqual([
      'Cheap',
      'Dear',
    ]);
  });

  it('sorts deadlines soonest first', () => {
    const rows = [
      row(uni({ name: 'Later', semesters: [semester('Spring', '2026-12-01')] })),
      row(uni({ name: 'Sooner', semesters: [semester('Fall', '2026-08-25')] })),
    ];
    expect(names(applyView(rows, sortBy('deadline'), EMPTY_FILTERS, 'en'))).toEqual([
      'Sooner',
      'Later',
    ]);
  });

  it('sorts documents by proportion complete, not raw count', () => {
    const rows = [
      row(uni({ name: 'Half' }), { docs: { total: 10, checked: 5 } }),
      row(uni({ name: 'Nearly' }), { docs: { total: 4, checked: 3 } }),
    ];
    expect(names(applyView(rows, sortBy('docs'), EMPTY_FILTERS, 'en'))).toEqual(['Half', 'Nearly']);
  });

  /**
   * Semantic order, not alphabetical. "dream, safety, target" would read as a
   * bug to any student.
   */
  it('sorts tier dream → target → safety', () => {
    const rows = [
      row(uni({ name: 'S' }), { tier: 'safety' }),
      row(uni({ name: 'D' }), { tier: 'dream' }),
      row(uni({ name: 'T' }), { tier: 'target' }),
    ];
    expect(names(applyView(rows, sortBy('tier'), EMPTY_FILTERS, 'en'))).toEqual(['D', 'T', 'S']);
  });

  it('sorts status along the application pipeline', () => {
    const rows = [
      row(uni({ name: 'Accepted' }), { status: 'accepted' }),
      row(uni({ name: 'Planning' }), { status: 'planning' }),
      row(uni({ name: 'Applied' }), { status: 'applied' }),
    ];
    expect(names(applyView(rows, sortBy('status'), EMPTY_FILTERS, 'en'))).toEqual([
      'Planning',
      'Applied',
      'Accepted',
    ]);
  });

  it('falls back to the suggested tier when the student has not set one', () => {
    const rows = [
      row(uni({ name: 'Suggested safety' }), { fitTier: 'safety' }),
      row(uni({ name: 'Explicit dream' }), { tier: 'dream' }),
    ];
    expect(names(applyView(rows, sortBy('tier'), EMPTY_FILTERS, 'en'))).toEqual([
      'Explicit dream',
      'Suggested safety',
    ]);
  });
});

/**
 * A university with no QS ranking heading an ascending list would be an answer
 * to a question nobody asked.
 */
describe('applyView — nulls sort last in both directions', () => {
  const rows = () => [
    row(uni({ name: 'Unranked' })),
    row(uni({ name: 'Ranked 50', ranking_qs: 50 })),
    row(uni({ name: 'Ranked 900', ranking_qs: 900 })),
  ];

  it('ascending', () => {
    expect(names(applyView(rows(), sortBy('ranking'), EMPTY_FILTERS, 'en'))).toEqual([
      'Ranked 50',
      'Ranked 900',
      'Unranked',
    ]);
  });

  it('descending', () => {
    expect(names(applyView(rows(), sortBy('ranking', 'desc'), EMPTY_FILTERS, 'en'))).toEqual([
      'Ranked 900',
      'Ranked 50',
      'Unranked',
    ]);
  });

  it('applies to undated deadlines too', () => {
    const undated = [
      row(uni({ name: 'No dates' })),
      row(uni({ name: 'Dated', semesters: [semester('Fall', '2026-08-25')] })),
    ];
    expect(names(applyView(undated, sortBy('deadline', 'desc'), EMPTY_FILTERS, 'en'))).toEqual([
      'Dated',
      'No dates',
    ]);
  });
});

describe('applyView — filters', () => {
  it('matches the search query against name, city and country', () => {
    const rows = [
      row(uni({ name: 'Bilkent', city: 'Ankara', country: 'Turkey' })),
      row(uni({ name: 'Warsaw Tech', city: 'Warsaw', country: 'Poland' })),
    ];

    expect(names(applyView(rows, DEFAULT_VIEW, filters({ query: 'bilk' }), 'en'))).toEqual([
      'Bilkent',
    ]);
    expect(names(applyView(rows, DEFAULT_VIEW, filters({ query: 'warsaw' }), 'en'))).toEqual([
      'Warsaw Tech',
    ]);
    expect(names(applyView(rows, DEFAULT_VIEW, filters({ query: 'turkey' }), 'en'))).toEqual([
      'Bilkent',
    ]);
  });

  it('ignores surrounding space in the query', () => {
    const rows = [row(uni({ name: 'Bilkent' }))];
    expect(applyView(rows, DEFAULT_VIEW, filters({ query: '   ' }), 'en')).toHaveLength(1);
  });

  it('filters by tier, including the suggested one', () => {
    const rows = [
      row(uni({ name: 'Dream' }), { tier: 'dream' }),
      row(uni({ name: 'Suggested dream' }), { fitTier: 'dream' }),
      row(uni({ name: 'Safety' }), { tier: 'safety' }),
    ];
    expect(names(applyView(rows, DEFAULT_VIEW, filters({ tiers: ['dream'] }), 'en'))).toEqual([
      'Dream',
      'Suggested dream',
    ]);
  });

  it('excludes rows with no tier at all when a tier filter is on', () => {
    const rows = [row(uni({ name: 'Untiered' }))];
    expect(applyView(rows, DEFAULT_VIEW, filters({ tiers: ['dream'] }), 'en')).toHaveLength(0);
  });

  it('treats multiple selected statuses as OR', () => {
    const rows = [
      row(uni({ name: 'A' }), { status: 'applied' }),
      row(uni({ name: 'B' }), { status: 'accepted' }),
      row(uni({ name: 'C' }), { status: 'planning' }),
    ];
    expect(
      names(applyView(rows, DEFAULT_VIEW, filters({ statuses: ['applied', 'accepted'] }), 'en')),
    ).toEqual(['A', 'B']);
  });

  it('filters by country', () => {
    const rows = [
      row(uni({ name: 'TR', country: 'Turkey' })),
      row(uni({ name: 'PL', country: 'Poland' })),
    ];
    expect(names(applyView(rows, DEFAULT_VIEW, filters({ countries: ['Poland'] }), 'en'))).toEqual([
      'PL',
    ]);
  });

  it('filters to MoE-approved only', () => {
    const rows = [
      row(uni({ name: 'Approved', moe_approved: true })),
      row(uni({ name: 'Not approved' })),
    ];
    expect(names(applyView(rows, DEFAULT_VIEW, filters({ moeOnly: true }), 'en'))).toEqual([
      'Approved',
    ]);
  });

  it('combines filters as AND', () => {
    const rows = [
      row(uni({ name: 'Both', country: 'Turkey', moe_approved: true })),
      row(uni({ name: 'Country only', country: 'Turkey' })),
      row(uni({ name: 'MoE only', country: 'Poland', moe_approved: true })),
    ];
    expect(
      names(applyView(rows, DEFAULT_VIEW, filters({ countries: ['Turkey'], moeOnly: true }), 'en')),
    ).toEqual(['Both']);
  });
});

describe('applyView — deadline window', () => {
  const rows = () => [
    row(uni({ name: 'In 20 days', semesters: [semester('Fall', '2026-08-25')] })),
    row(uni({ name: 'In 118 days', semesters: [semester('Spring', '2026-12-01')] })),
    row(uni({ name: 'Passed', semesters: [semester('Old', '2026-07-01')] })),
    row(uni({ name: 'Undated' })),
  ];

  it('keeps only deadlines inside the window', () => {
    expect(names(applyView(rows(), DEFAULT_VIEW, filters({ deadlineWithin: 30 }), 'en'))).toEqual([
      'In 20 days',
    ]);
  });

  it('widens with the window', () => {
    expect(names(applyView(rows(), DEFAULT_VIEW, filters({ deadlineWithin: 90 }), 'en'))).toEqual([
      'In 20 days',
    ]);
    expect(
      names(applyView(rows(), DEFAULT_VIEW, filters({ deadlineWithin: 'passed' }), 'en')),
    ).toEqual(['Passed']);
  });

  it('excludes undated rows, which cannot satisfy a deadline filter either way', () => {
    const shown = names(applyView(rows(), DEFAULT_VIEW, filters({ deadlineWithin: 30 }), 'en'));
    expect(shown).not.toContain('Undated');
  });

  it('shows every row when the window is off', () => {
    expect(applyView(rows(), DEFAULT_VIEW, EMPTY_FILTERS, 'en')).toHaveLength(4);
  });
});

describe('activeFilterCount', () => {
  it('is zero for a fresh filter set', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  });

  it('does not count a blank query', () => {
    expect(activeFilterCount(filters({ query: '   ' }))).toBe(0);
  });

  it('counts each active group once, however many values it holds', () => {
    expect(activeFilterCount(filters({ tiers: ['dream', 'target'] }))).toBe(1);
  });

  it('adds up across groups', () => {
    expect(
      activeFilterCount(
        filters({ query: 'x', tiers: ['dream'], moeOnly: true, deadlineWithin: 30 }),
      ),
    ).toBe(4);
  });
});
