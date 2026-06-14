import { describe, it, expect } from 'vitest';
import { dbRowToUniversity } from '@/lib/data/university-types';
import type { UniversityDbRow } from '@/lib/data/university-types';

const baseRow: UniversityDbRow = {
  id: 'abc-123',
  slug: 'test-university',
  name_en: 'Test University',
  name_ru: 'Тест Университет',
  name_tk: 'Test Uni',
  country: 'Turkey',
  city: 'Istanbul',
  tuition_usd: '5000',
  moe_approved: true,
  ranking_qs: 42,
  languages: ['English', 'Turkish'],
  majors: ['Computer Science'],
  official_website: 'https://test.edu',
  application_portal_url: 'https://apply.test.edu',
  entrance_requirements: { turkey: { yos: true } },
  semesters: null,
  tuition_options: null,
  created_at: '2024-01-01T00:00:00Z',
};

describe('dbRowToUniversity', () => {
  it('maps flat name columns to nested name object', () => {
    const u = dbRowToUniversity(baseRow);
    expect(u.name).toEqual({ en: 'Test University', ru: 'Тест Университет', tk: 'Test Uni' });
  });

  it('converts tuition_usd string to number', () => {
    const u = dbRowToUniversity(baseRow);
    expect(u.tuition_usd).toBe(5000);
    expect(typeof u.tuition_usd).toBe('number');
  });

  it('converts tuition_usd numeric type to number', () => {
    const u = dbRowToUniversity({ ...baseRow, tuition_usd: 1234 });
    expect(u.tuition_usd).toBe(1234);
  });

  it('defaults null entrance_requirements to empty object', () => {
    const u = dbRowToUniversity({ ...baseRow, entrance_requirements: null as unknown as Record<string, unknown> });
    expect(u.entrance_requirements).toEqual({});
  });

  it('preserves entrance_requirements when present', () => {
    const u = dbRowToUniversity(baseRow);
    expect(u.entrance_requirements).toEqual({ turkey: { yos: true } });
  });

  it('preserves id, country, city', () => {
    const u = dbRowToUniversity(baseRow);
    expect(u.id).toBe('abc-123');
    expect(u.country).toBe('Turkey');
    expect(u.city).toBe('Istanbul');
  });

  it('preserves moe_approved and ranking_qs', () => {
    const u = dbRowToUniversity(baseRow);
    expect(u.moe_approved).toBe(true);
    expect(u.ranking_qs).toBe(42);
  });

  it('handles null ranking_qs', () => {
    const u = dbRowToUniversity({ ...baseRow, ranking_qs: null });
    expect(u.ranking_qs).toBeNull();
  });

  it('excludes created_at from the result', () => {
    const u = dbRowToUniversity(baseRow);
    expect('created_at' in u).toBe(false);
  });

  it('defaults null tuition_options to an empty array', () => {
    const u = dbRowToUniversity(baseRow);
    expect(u.tuition_options).toEqual([]);
  });

  it('parses tuition_options when present', () => {
    const u = dbRowToUniversity({
      ...baseRow,
      tuition_options: [{ semester: 'Fall', language: 'English', major: null, amount_usd: 5000, note: null }],
    });
    expect(u.tuition_options).toEqual([
      { semester: 'Fall', language: 'English', major: null, amount_usd: 5000, note: null },
    ]);
  });
});
