import { z } from 'zod';
import type { Locale } from '@/lib/constants';
import { STATUSES, TIERS, type Status, type Tier } from '@/lib/data/list-types';
import { universityName, type ListRow } from './row-view';

/* ------------------------------------------------------------------ *
 * Sort
 * ------------------------------------------------------------------ */

/**
 * Sorting is driven by clicking column headers, so the sort key is a column id.
 *
 * Scholarships, flags, notes and custom columns are deliberately absent: none
 * of them has an ordering a student would agree on, and a header that sorts
 * into a meaningless arrangement is worse than one that does not sort at all.
 */
export const SORTABLE_COLUMN_IDS = [
  'university',
  'tier',
  'status',
  'deadline',
  'tuition',
  'net_cost',
  'docs',
  'moe',
  'ranking',
  'acceptance',
] as const;
export type SortableColumnId = (typeof SORTABLE_COLUMN_IDS)[number];

export type SortDir = 'asc' | 'desc';
export type ListSort = { columnId: SortableColumnId; dir: SortDir };

/** `sort: null` is manual drag order — the student's own arrangement. */
export type ListView = { sort: ListSort | null };

export const DEFAULT_VIEW: ListView = { sort: null };

export const ListViewSchema = z.object({
  sort: z
    .object({ columnId: z.enum(SORTABLE_COLUMN_IDS), dir: z.enum(['asc', 'desc']) })
    .nullable()
    .default(null),
});

export function isSortable(columnId: string): columnId is SortableColumnId {
  return (SORTABLE_COLUMN_IDS as readonly string[]).includes(columnId);
}

/**
 * A stored view outlives releases, so a sort naming a column we since removed
 * has to degrade to manual order rather than throwing.
 */
export function normalizeView(raw: unknown): ListView {
  return ListViewSchema.safeParse(raw).data ?? DEFAULT_VIEW;
}

/* ------------------------------------------------------------------ *
 * Filters
 * ------------------------------------------------------------------ */

export const DEADLINE_WINDOWS = [30, 60, 90] as const;
export type DeadlineWindow = (typeof DEADLINE_WINDOWS)[number] | 'passed' | null;

export type ListFilters = {
  query: string;
  tiers: Tier[];
  statuses: Status[];
  countries: string[];
  moeOnly: boolean;
  deadlineWithin: DeadlineWindow;
};

export const EMPTY_FILTERS: ListFilters = {
  query: '',
  tiers: [],
  statuses: [],
  countries: [],
  moeOnly: false,
  deadlineWithin: null,
};

export function activeFilterCount(filters: ListFilters): number {
  return (
    (filters.query.trim() ? 1 : 0) +
    (filters.tiers.length ? 1 : 0) +
    (filters.statuses.length ? 1 : 0) +
    (filters.countries.length ? 1 : 0) +
    (filters.moeOnly ? 1 : 0) +
    (filters.deadlineWithin !== null ? 1 : 0)
  );
}

/* ------------------------------------------------------------------ *
 * Applying both
 * ------------------------------------------------------------------ */

/**
 * Filter, then sort. Never mutates the input, so "My order" can always be
 * restored by dropping the view rather than by recovering it.
 */
export function applyView(
  rows: ListRow[],
  view: ListView,
  filters: ListFilters,
  locale: Locale,
): ListRow[] {
  const filtered = rows.filter((row) => matchesFilters(row, filters, locale));
  if (!view.sort) return filtered;

  const { columnId, dir } = view.sort;
  return [...filtered].sort((a, b) => {
    const av = sortValue(a, columnId, locale);
    const bv = sortValue(b, columnId, locale);

    // Nulls sort last in *both* directions. A university with no QS ranking
    // heading an ascending list would be an answer to a question nobody asked.
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;

    const base =
      typeof av === 'string'
        ? av.localeCompare(String(bv), locale)
        : (av as number) - (bv as number);

    return dir === 'asc' ? base : -base;
  });
}

function matchesFilters(row: ListRow, filters: ListFilters, locale: Locale): boolean {
  const uni = row.university;

  const query = filters.query.trim().toLocaleLowerCase(locale);
  if (query) {
    const haystack = [universityName(uni, locale), uni.name.en, uni.city, uni.country]
      .join(' ')
      .toLocaleLowerCase(locale);
    if (!haystack.includes(query)) return false;
  }

  if (filters.tiers.length) {
    const tier = row.entry.tier ?? row.fit.tier;
    if (!tier || !filters.tiers.includes(tier)) return false;
  }

  if (filters.statuses.length && !filters.statuses.includes(row.entry.status)) return false;
  if (filters.countries.length && !filters.countries.includes(uni.country)) return false;
  if (filters.moeOnly && !uni.moe_approved) return false;

  if (filters.deadlineWithin !== null) {
    const days = row.deadline?.days;
    // A row with no dated deadline cannot satisfy a deadline filter either way.
    if (days == null) return false;
    if (filters.deadlineWithin === 'passed') {
      if (days >= 0) return false;
    } else if (days < 0 || days > filters.deadlineWithin) {
      return false;
    }
  }

  return true;
}

function sortValue(row: ListRow, columnId: SortableColumnId, locale: Locale): string | number | null {
  const uni = row.university;

  switch (columnId) {
    case 'university':
      return universityName(uni, locale);
    case 'tier': {
      // Semantic order, not alphabetical: a student thinks dream → target →
      // safety, and "dream, safety, target" would read as a bug.
      const tier = row.entry.tier ?? row.fit.tier;
      return tier ? TIERS.indexOf(tier) : null;
    }
    case 'status':
      return STATUSES.indexOf(row.entry.status);
    case 'deadline':
      return row.deadline?.semester.deadline ?? null;
    case 'tuition':
      return uni.tuition_usd;
    case 'net_cost':
      return row.netCostMinUsd;
    case 'docs':
      return row.docs && row.docs.total > 0 ? row.docs.checked / row.docs.total : null;
    case 'moe':
      return uni.moe_approved ? 1 : 0;
    case 'ranking':
      return uni.ranking_qs;
    case 'acceptance':
      return uni.acceptance_rate_min;
  }
}
