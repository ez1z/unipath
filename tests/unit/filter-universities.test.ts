import { describe, it, expect } from 'vitest';
import { filterUniversities } from '@/lib/data/filter-universities';
import type { University } from '@/lib/data/university-types';

function makeUni(overrides: Partial<University> = {}): University {
  return {
    id: '1',
    slug: 'default-university',
    name: { en: 'Default University', ru: 'Университет', tk: 'Uniwersitet' },
    country: 'Turkey',
    city: 'Ankara',
    tuition_usd: 5000,
    moe_approved: false,
    ranking_qs: null,
    languages: ['English'],
    majors: ['Engineering'],
    official_website: 'https://example.edu',
    application_portal_url: 'https://apply.example.edu',
    entrance_requirements: {},
    semesters: [],
    tuition_options: [],
    ...overrides,
  };
}

const unis: University[] = [
  makeUni({
    id: '1',
    name: { en: 'MIT', ru: 'МИТ', tk: 'MIT' },
    country: 'USA',
    city: 'Cambridge',
    languages: ['English'],
    majors: ['Engineering', 'Computer Science'],
    moe_approved: true,
  }),
  makeUni({
    id: '2',
    name: { en: 'Moscow State University', ru: 'МГУ', tk: 'MGU' },
    country: 'Russia',
    city: 'Moscow',
    languages: ['Russian'],
    majors: ['Medicine', 'Law'],
    moe_approved: false,
  }),
  makeUni({
    id: '3',
    name: { en: 'Ankara University', ru: 'Анкарский Университет', tk: 'Ankara Uni' },
    country: 'Turkey',
    city: 'Ankara',
    languages: ['Turkish', 'English'],
    majors: ['Computer Science', 'Engineering'],
    moe_approved: true,
  }),
];

describe('filterUniversities', () => {
  it('returns all universities when params are empty', () => {
    expect(filterUniversities(unis, {})).toHaveLength(3);
  });

  it('filters by moeOnly', () => {
    const result = filterUniversities(unis, { moeOnly: true });
    expect(result).toHaveLength(2);
    expect(result.every((u) => u.moe_approved)).toBe(true);
  });

  it('moeOnly: false does not filter', () => {
    expect(filterUniversities(unis, { moeOnly: false })).toHaveLength(3);
  });

  it('filters by exact country', () => {
    const result = filterUniversities(unis, { country: 'Russia' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('filters by language (exact array membership)', () => {
    const result = filterUniversities(unis, { language: 'Russian' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('filters by language present in multiple universities', () => {
    const result = filterUniversities(unis, { language: 'English' });
    expect(result).toHaveLength(2);
    expect(result.map((u) => u.id).sort()).toEqual(['1', '3'].sort());
  });

  it('filters by major (case-insensitive substring)', () => {
    const result = filterUniversities(unis, { major: 'engineering' });
    expect(result).toHaveLength(2);
    expect(result.map((u) => u.id).sort()).toEqual(['1', '3'].sort());
  });

  it('filters by major (partial match)', () => {
    const result = filterUniversities(unis, { major: 'comput' });
    expect(result).toHaveLength(2);
  });

  it('filters by query matching English name', () => {
    const result = filterUniversities(unis, { query: 'mit' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by query matching Russian name', () => {
    const result = filterUniversities(unis, { query: 'мгу' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('filters by query matching Turkmen name', () => {
    const result = filterUniversities(unis, { query: 'ankara uni' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('filters by query matching city', () => {
    const result = filterUniversities(unis, { query: 'cambridge' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by query matching country', () => {
    const result = filterUniversities(unis, { query: 'russia' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('query is case-insensitive', () => {
    expect(filterUniversities(unis, { query: 'MOSCOW' })).toHaveLength(1);
    expect(filterUniversities(unis, { query: 'moscow' })).toHaveLength(1);
  });

  it('applies combined filters (country + moeOnly)', () => {
    const result = filterUniversities(unis, { country: 'Turkey', moeOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('applies combined filters (language + moeOnly)', () => {
    const result = filterUniversities(unis, { language: 'English', moeOnly: true });
    expect(result).toHaveLength(2);
  });

  it('applies combined filters (country + language + moeOnly)', () => {
    const result = filterUniversities(unis, { country: 'Turkey', language: 'English', moeOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('returns empty array when no match', () => {
    const result = filterUniversities(unis, { query: 'zzz_nonexistent_zzz' });
    expect(result).toHaveLength(0);
  });

  it('returns empty array on empty input', () => {
    expect(filterUniversities([], { query: 'MIT' })).toHaveLength(0);
  });
});
