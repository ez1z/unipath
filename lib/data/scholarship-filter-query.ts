import { COVERAGE_ITEMS } from './scholarship-types';
import type { CoverageItem, ScholarshipSortBy, ScholarshipType } from './scholarship-types';

export type ScholarshipListFilters = {
  query: string;
  country: string;
  type: string;
  coverage: string;
  hasAmount: boolean;
  minAmount: string;
  deadlineStatus: '' | 'upcoming' | 'passed';
  sortBy: ScholarshipSortBy;
  prefs: boolean;
  scores: boolean;
};

export const DEFAULT_SCHOLARSHIP_FILTERS: ScholarshipListFilters = {
  query: '',
  country: '',
  type: '',
  coverage: '',
  hasAmount: false,
  minAmount: '',
  deadlineStatus: '',
  sortBy: 'name',
  prefs: false,
  scores: false,
};

const SORT_VALUES: readonly ScholarshipSortBy[] = ['name', 'amount_desc', 'amount_asc', 'deadline_asc', 'deadline_desc'];
const TYPE_VALUES: readonly ScholarshipType[] = ['government', 'merit', 'need-based', 'partial'];

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((v) => v === value);
}

function parseMinAmount(value: string | null): string {
  if (!value || value.trim() === '') return '';
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? value : '';
}

/**
 * Reads the scholarship list filters from a query string (e.g. `useSearchParams()`).
 * Unknown or malformed values fall back to the defaults, so a hand-edited or
 * stale shared link never puts the list into an impossible state.
 */
export function parseScholarshipFilters(params: { get(name: string): string | null }): ScholarshipListFilters {
  return {
    query: params.get('q') ?? '',
    country: params.get('country') ?? '',
    type: oneOf(params.get('type'), TYPE_VALUES) ?? '',
    coverage: oneOf<CoverageItem>(params.get('coverage'), COVERAGE_ITEMS) ?? '',
    hasAmount: params.get('amount') === '1',
    minAmount: parseMinAmount(params.get('minAmount')),
    deadlineStatus: oneOf(params.get('deadline'), ['upcoming', 'passed'] as const) ?? '',
    sortBy: oneOf(params.get('sort'), SORT_VALUES) ?? 'name',
    prefs: params.get('prefs') === '1',
    scores: params.get('scores') === '1',
  };
}

/** Serialises the filters to a query string, omitting defaults ('' when nothing is set). */
export function buildScholarshipFiltersQuery(filters: ScholarshipListFilters): string {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.country) params.set('country', filters.country);
  if (filters.type) params.set('type', filters.type);
  if (filters.coverage) params.set('coverage', filters.coverage);
  if (filters.hasAmount) params.set('amount', '1');
  if (filters.minAmount) params.set('minAmount', filters.minAmount);
  if (filters.deadlineStatus) params.set('deadline', filters.deadlineStatus);
  if (filters.sortBy !== 'name') params.set('sort', filters.sortBy);
  if (filters.prefs) params.set('prefs', '1');
  if (filters.scores) params.set('scores', '1');
  return params.toString();
}
