import { describe, it, expect } from 'vitest';
import { buildScholarshipFilterChips, buildUniversityFilterChips } from '@/lib/data/filter-chips';
import type { ScholarshipChipFilters, UniversityChipFilters } from '@/lib/data/filter-chips';
import { parseNonNegativeNumberParam } from '@/lib/data/query-params';
import { formatTuition } from '@/lib/format';

// Echo the message key so assertions show which string each chip uses.
const t = (key: string) => `<${key}>`;

const NO_SCHOLARSHIP_FILTERS: ScholarshipChipFilters = {
  country: '',
  type: '',
  coverage: '',
  minAmount: '',
  deadlineStatus: '',
  hasAmount: false,
  prefs: false,
  scores: false,
};

const NO_UNIVERSITY_FILTERS: UniversityChipFilters = {
  country: '',
  language: '',
  major: '',
  maxTuition: '',
  deadlineStatus: '',
  moeOnly: false,
  rankedOnly: false,
  prefs: false,
  scores: false,
};

describe('buildScholarshipFilterChips', () => {
  it('returns no chips when nothing is set', () => {
    expect(buildScholarshipFilterChips(NO_SCHOLARSHIP_FILTERS, t)).toEqual([]);
  });

  it('builds one chip per active filter, in a stable order', () => {
    const chips = buildScholarshipFilterChips(
      {
        country: 'Turkey',
        type: 'need-based',
        coverage: 'stipend',
        minAmount: '5000',
        deadlineStatus: 'upcoming',
        hasAmount: true,
        prefs: true,
        scores: true,
      },
      t,
    );
    expect(chips).toEqual([
      { key: 'country', label: 'Turkey' },
      { key: 'type', label: '<filter_type>: <type_need_based>' },
      { key: 'coverage', label: '<filter_coverage>: <coverage_stipend>' },
      { key: 'minAmount', label: `<filter_min_amount>: ${formatTuition(5000)}` },
      { key: 'deadline', label: '<filter_deadline>: <filter_deadline_upcoming>' },
      { key: 'amount', label: '<filter_has_amount>' },
      { key: 'prefs', label: '<filter_my_preferences>' },
      { key: 'scores', label: '<filter_my_results>' },
    ]);
  });

  it('shows money in both USD and TMT', () => {
    const [chip] = buildScholarshipFilterChips({ ...NO_SCHOLARSHIP_FILTERS, minAmount: '5000' }, t);
    expect(chip.label).toContain('$5,000');
    expect(chip.label).toContain('TMT');
  });

  it('keeps a zero minimum amount', () => {
    const [chip] = buildScholarshipFilterChips({ ...NO_SCHOLARSHIP_FILTERS, minAmount: '0' }, t);
    expect(chip.key).toBe('minAmount');
  });

  it('skips a non-numeric amount instead of showing NaN', () => {
    expect(buildScholarshipFilterChips({ ...NO_SCHOLARSHIP_FILTERS, minAmount: 'abc' }, t)).toEqual([]);
  });

  it('falls back to the raw value for unknown type, coverage or deadline', () => {
    const chips = buildScholarshipFilterChips(
      { ...NO_SCHOLARSHIP_FILTERS, type: 'sports', coverage: 'food', deadlineStatus: 'soon' },
      t,
    );
    expect(chips.map((c) => c.label)).toEqual([
      '<filter_type>: sports',
      '<filter_coverage>: food',
      '<filter_deadline>: soon',
    ]);
  });

  it('has unique keys', () => {
    const chips = buildScholarshipFilterChips(
      { ...NO_SCHOLARSHIP_FILTERS, country: 'X', type: 'merit', coverage: 'health', minAmount: '1', deadlineStatus: 'passed', hasAmount: true, prefs: true, scores: true },
      t,
    );
    expect(new Set(chips.map((c) => c.key)).size).toBe(chips.length);
  });
});

describe('buildUniversityFilterChips', () => {
  it('returns no chips when nothing is set', () => {
    expect(buildUniversityFilterChips(NO_UNIVERSITY_FILTERS, t)).toEqual([]);
  });

  it('builds one chip per active filter, in a stable order', () => {
    const chips = buildUniversityFilterChips(
      {
        country: 'Malaysia',
        language: 'en',
        major: 'Computer Science',
        maxTuition: '12000',
        deadlineStatus: 'passed',
        moeOnly: true,
        rankedOnly: true,
        prefs: true,
        scores: true,
      },
      t,
    );
    expect(chips).toEqual([
      { key: 'country', label: 'Malaysia' },
      { key: 'language', label: '<filter_language>: EN' },
      { key: 'major', label: 'Computer Science' },
      { key: 'maxTuition', label: `<filter_max_tuition>: ${formatTuition(12000)}` },
      { key: 'deadline', label: '<filter_deadline>: <filter_deadline_passed>' },
      { key: 'moe', label: '<filter_moe>' },
      { key: 'ranked', label: '<filter_ranked_only>' },
      { key: 'prefs', label: '<filter_my_preferences>' },
      { key: 'scores', label: '<filter_my_results>' },
    ]);
  });

  it('shows max tuition in both USD and TMT', () => {
    const [chip] = buildUniversityFilterChips({ ...NO_UNIVERSITY_FILTERS, maxTuition: '8000' }, t);
    expect(chip.label).toContain('$8,000');
    expect(chip.label).toContain('TMT');
  });

  it('skips a non-numeric max tuition instead of showing $NaN', () => {
    expect(buildUniversityFilterChips({ ...NO_UNIVERSITY_FILTERS, maxTuition: 'abc' }, t)).toEqual([]);
  });
});

describe('parseNonNegativeNumberParam', () => {
  it('keeps finite non-negative numbers as given', () => {
    expect(parseNonNegativeNumberParam('0')).toBe('0');
    expect(parseNonNegativeNumberParam('12000')).toBe('12000');
    expect(parseNonNegativeNumberParam('2500.5')).toBe('2500.5');
  });

  it('drops missing, blank, malformed, negative and infinite values', () => {
    expect(parseNonNegativeNumberParam(null)).toBe('');
    expect(parseNonNegativeNumberParam('')).toBe('');
    expect(parseNonNegativeNumberParam(' ')).toBe('');
    expect(parseNonNegativeNumberParam('abc')).toBe('');
    expect(parseNonNegativeNumberParam('-1')).toBe('');
    expect(parseNonNegativeNumberParam('Infinity')).toBe('');
  });
});
