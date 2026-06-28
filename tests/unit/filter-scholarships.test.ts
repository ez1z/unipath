import { describe, it, expect } from 'vitest';
import { filterScholarships } from '@/lib/data/filter-scholarships';
import type { Scholarship } from '@/lib/data/scholarship-types';

function makeScholarship(overrides: Partial<Scholarship> = {}): Scholarship {
  return {
    id: '1',
    slug: 'default',
    university_id: null,
    country: 'Turkey',
    name: { en: 'Default Scholarship', ru: 'Стипендия', tk: 'Stipendiýa' },
    type: 'merit',
    coverage: ['tuition'],
    amount_usd: null,
    amount_usd_max: null,
    acceptance_rate_min: null,
    acceptance_rate_max: null,
    deadline_text: null,
    semesters: [],
    requirements: {},
    description: { en: '', ru: '', tk: '' },
    application_url: '',
    ...overrides,
  };
}

const scholarships: Scholarship[] = [
  makeScholarship({
    id: '1',
    country: 'Turkey',
    type: 'government',
    coverage: ['tuition', 'accommodation'],
    name: { en: 'Türkiye Scholarship', ru: 'Стипендия Турции', tk: 'Türkiýe stipendiýasy' },
  }),
  makeScholarship({
    id: '2',
    country: 'Russia',
    type: 'merit',
    coverage: ['tuition'],
    name: { en: 'Russian Government Grant', ru: 'Грант правительства', tk: 'Rus granty' },
  }),
  makeScholarship({
    id: '3',
    country: 'Germany',
    type: 'need-based',
    coverage: ['tuition', 'stipend', 'flights'],
    name: { en: 'DAAD Fellowship', ru: 'Стипендия DAAD', tk: 'DAAD stipendiýasy' },
  }),
];

describe('filterScholarships', () => {
  it('returns all scholarships when params are empty', () => {
    expect(filterScholarships(scholarships, {})).toHaveLength(3);
  });

  it('filters by exact country', () => {
    const result = filterScholarships(scholarships, { country: 'Russia' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('returns empty array when no country matches', () => {
    expect(filterScholarships(scholarships, { country: 'USA' })).toHaveLength(0);
  });

  it('filters by exact type', () => {
    const result = filterScholarships(scholarships, { type: 'government' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by coverage using array includes', () => {
    const result = filterScholarships(scholarships, { coverage: 'stipend' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('filters by coverage matching multiple scholarships', () => {
    const result = filterScholarships(scholarships, { coverage: 'tuition' });
    expect(result).toHaveLength(3);
  });

  it('filters by query matching English name (case-insensitive)', () => {
    const result = filterScholarships(scholarships, { query: 'daad' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('filters by query matching Russian name', () => {
    const result = filterScholarships(scholarships, { query: 'грант' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('filters by query matching Turkmen name', () => {
    const result = filterScholarships(scholarships, { query: 'türkiýe' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by query matching country name', () => {
    const result = filterScholarships(scholarships, { query: 'germany' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('query is case-insensitive', () => {
    expect(filterScholarships(scholarships, { query: 'DAAD' })).toHaveLength(1);
    expect(filterScholarships(scholarships, { query: 'daad' })).toHaveLength(1);
  });

  it('applies combined country + type filter', () => {
    const result = filterScholarships(scholarships, { country: 'Turkey', type: 'government' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('applies combined country + coverage filter', () => {
    const result = filterScholarships(scholarships, { country: 'Germany', coverage: 'flights' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('applies combined type + coverage filter', () => {
    const result = filterScholarships(scholarships, { type: 'need-based', coverage: 'stipend' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('returns empty array when combined filters yield no match', () => {
    const result = filterScholarships(scholarships, { country: 'Turkey', type: 'partial' });
    expect(result).toHaveLength(0);
  });

  it('returns empty array on empty input', () => {
    expect(filterScholarships([], { query: 'Turkey' })).toHaveLength(0);
  });
});
