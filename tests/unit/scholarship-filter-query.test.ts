import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SCHOLARSHIP_FILTERS,
  buildScholarshipFiltersQuery,
  parseScholarshipFilters,
} from '@/lib/data/scholarship-filter-query';
import type { ScholarshipListFilters } from '@/lib/data/scholarship-filter-query';

function parse(query: string): ScholarshipListFilters {
  return parseScholarshipFilters(new URLSearchParams(query));
}

describe('parseScholarshipFilters', () => {
  it('returns the defaults for an empty query string', () => {
    expect(parse('')).toEqual(DEFAULT_SCHOLARSHIP_FILTERS);
  });

  it('reads every supported param', () => {
    expect(
      parse('q=gov&country=Turkey&type=government&coverage=tuition&amount=1&minAmount=5000&deadline=upcoming&sort=amount_desc&prefs=1&scores=1'),
    ).toEqual({
      query: 'gov',
      country: 'Turkey',
      type: 'government',
      coverage: 'tuition',
      hasAmount: true,
      minAmount: '5000',
      deadlineStatus: 'upcoming',
      sortBy: 'amount_desc',
      prefs: true,
      scores: true,
    });
  });

  it('keeps free-text params as given', () => {
    const f = parse(`q=${encodeURIComponent('  Türkiye & co ')}&country=${encodeURIComponent('South Korea')}`);
    expect(f.query).toBe('  Türkiye & co ');
    expect(f.country).toBe('South Korea');
  });

  it('falls back to "name" for an unknown sort', () => {
    expect(parse('sort=bogus').sortBy).toBe('name');
    expect(parse('sort=ranking').sortBy).toBe('name');
  });

  it('falls back to "" for an unknown deadline status', () => {
    expect(parse('deadline=soon').deadlineStatus).toBe('');
    expect(parse('deadline=passed').deadlineStatus).toBe('passed');
  });

  it('falls back to "" for an unknown coverage item', () => {
    expect(parse('coverage=food').coverage).toBe('');
    expect(parse('coverage=stipend').coverage).toBe('stipend');
  });

  it('falls back to "" for an unknown scholarship type', () => {
    expect(parse('type=sports').type).toBe('');
    expect(parse('type=need-based').type).toBe('need-based');
  });

  it('drops a minAmount that is not a finite non-negative number', () => {
    expect(parse('minAmount=abc').minAmount).toBe('');
    expect(parse('minAmount=-100').minAmount).toBe('');
    expect(parse('minAmount=Infinity').minAmount).toBe('');
    expect(parse('minAmount=%20').minAmount).toBe('');
    expect(parse('minAmount=0').minAmount).toBe('0');
    expect(parse('minAmount=2500.5').minAmount).toBe('2500.5');
  });

  it('treats only "1" as true for boolean params', () => {
    expect(parse('amount=true&prefs=yes&scores=0')).toMatchObject({
      hasAmount: false,
      prefs: false,
      scores: false,
    });
  });
});

describe('buildScholarshipFiltersQuery', () => {
  it('produces an empty string for the defaults', () => {
    expect(buildScholarshipFiltersQuery(DEFAULT_SCHOLARSHIP_FILTERS)).toBe('');
  });

  it('omits default values and uses the short param names', () => {
    expect(
      buildScholarshipFiltersQuery({
        ...DEFAULT_SCHOLARSHIP_FILTERS,
        country: 'Turkey',
        coverage: 'tuition',
        hasAmount: true,
        deadlineStatus: 'upcoming',
      }),
    ).toBe('country=Turkey&coverage=tuition&amount=1&deadline=upcoming');
  });

  it('round-trips through parseScholarshipFilters', () => {
    const filters: ScholarshipListFilters = {
      query: 'Türkiye burslari & more',
      country: 'South Korea',
      type: 'merit',
      coverage: 'health',
      hasAmount: true,
      minAmount: '1000',
      deadlineStatus: 'passed',
      sortBy: 'deadline_desc',
      prefs: true,
      scores: true,
    };
    expect(parse(buildScholarshipFiltersQuery(filters))).toEqual(filters);
  });

  it('round-trips the defaults', () => {
    expect(parse(buildScholarshipFiltersQuery(DEFAULT_SCHOLARSHIP_FILTERS))).toEqual(DEFAULT_SCHOLARSHIP_FILTERS);
  });
});
