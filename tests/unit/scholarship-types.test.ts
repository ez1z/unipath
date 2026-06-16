import { describe, it, expect } from 'vitest';
import { dbRowToScholarship, ScholarshipCsvRowSchema } from '@/lib/data/scholarship-types';
import type { ScholarshipDbRow } from '@/lib/data/scholarship-types';

const baseRow: ScholarshipDbRow = {
  id: 'sch-1',
  slug: 'global-merit-turkey',
  university_id: 'uni-abc',
  country: 'Turkey',
  name_en: 'Global Merit Award',
  name_ru: 'Глобальная награда',
  name_tk: 'Global sylag',
  type: 'merit',
  coverage: ['tuition', 'accommodation'],
  amount_usd: '5000',
  deadline_text: 'March 31',
  semesters: [{ name: 'Fall', start_date: '2024-09-01', deadline: null }],
  requirements: {},
  description_en: 'Desc EN',
  description_ru: 'Desc RU',
  description_tk: 'Desc TK',
  application_url: 'https://apply.example.com',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

describe('dbRowToScholarship', () => {
  it('maps flat name columns to nested name object', () => {
    const s = dbRowToScholarship(baseRow);
    expect(s.name).toEqual({ en: 'Global Merit Award', ru: 'Глобальная награда', tk: 'Global sylag' });
  });

  it('maps flat description columns to nested description object', () => {
    const s = dbRowToScholarship(baseRow);
    expect(s.description).toEqual({ en: 'Desc EN', ru: 'Desc RU', tk: 'Desc TK' });
  });

  it('converts amount_usd string to number', () => {
    const s = dbRowToScholarship(baseRow);
    expect(s.amount_usd).toBe(5000);
    expect(typeof s.amount_usd).toBe('number');
  });

  it('converts numeric amount_usd to number', () => {
    const s = dbRowToScholarship({ ...baseRow, amount_usd: 7500 });
    expect(s.amount_usd).toBe(7500);
  });

  it('preserves null amount_usd', () => {
    const s = dbRowToScholarship({ ...baseRow, amount_usd: null });
    expect(s.amount_usd).toBeNull();
  });

  it('parses semesters from valid JSON array', () => {
    const s = dbRowToScholarship(baseRow);
    expect(s.semesters).toHaveLength(1);
    expect(s.semesters[0].name).toBe('Fall');
  });

  it('returns empty semesters array for invalid JSON', () => {
    const s = dbRowToScholarship({ ...baseRow, semesters: 'not-an-array' });
    expect(s.semesters).toEqual([]);
  });

  it('preserves id, slug, university_id, country, type', () => {
    const s = dbRowToScholarship(baseRow);
    expect(s.id).toBe('sch-1');
    expect(s.slug).toBe('global-merit-turkey');
    expect(s.university_id).toBe('uni-abc');
    expect(s.country).toBe('Turkey');
    expect(s.type).toBe('merit');
  });

  it('preserves coverage array', () => {
    const s = dbRowToScholarship(baseRow);
    expect(s.coverage).toEqual(['tuition', 'accommodation']);
  });

  it('preserves deadline_text and application_url', () => {
    const s = dbRowToScholarship(baseRow);
    expect(s.deadline_text).toBe('March 31');
    expect(s.application_url).toBe('https://apply.example.com');
  });

  it('handles null university_id', () => {
    const s = dbRowToScholarship({ ...baseRow, university_id: null });
    expect(s.university_id).toBeNull();
  });
});

const validCsvRow = {
  name_en: 'Global Merit Award',
  name_ru: 'Глобальная награда',
  name_tk: 'Global sylag',
  country: 'Turkey',
  type: 'merit',
};

describe('ScholarshipCsvRowSchema', () => {
  it('parses a minimal valid row', () => {
    const result = ScholarshipCsvRowSchema.safeParse(validCsvRow);
    expect(result.success).toBe(true);
  });

  it('fails when name_en is empty', () => {
    expect(ScholarshipCsvRowSchema.safeParse({ ...validCsvRow, name_en: '' }).success).toBe(false);
  });

  it('fails when name_ru is empty', () => {
    expect(ScholarshipCsvRowSchema.safeParse({ ...validCsvRow, name_ru: '' }).success).toBe(false);
  });

  it('fails when name_tk is empty', () => {
    expect(ScholarshipCsvRowSchema.safeParse({ ...validCsvRow, name_tk: '' }).success).toBe(false);
  });

  it('fails when country is empty', () => {
    expect(ScholarshipCsvRowSchema.safeParse({ ...validCsvRow, country: '' }).success).toBe(false);
  });

  it('fails when type is not a valid enum value', () => {
    expect(ScholarshipCsvRowSchema.safeParse({ ...validCsvRow, type: 'invalid' }).success).toBe(false);
  });

  it('accepts all valid type values', () => {
    for (const type of ['government', 'merit', 'need-based', 'partial']) {
      expect(ScholarshipCsvRowSchema.safeParse({ ...validCsvRow, type }).success).toBe(true);
    }
  });

  it('splits pipe-separated coverage into an array', () => {
    const result = ScholarshipCsvRowSchema.safeParse({ ...validCsvRow, coverage: 'tuition|accommodation' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.coverage).toEqual(['tuition', 'accommodation']);
  });

  it('treats missing coverage as empty array', () => {
    const result = ScholarshipCsvRowSchema.safeParse(validCsvRow);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.coverage).toEqual([]);
  });

  it('converts a positive amount_usd string to number', () => {
    const result = ScholarshipCsvRowSchema.safeParse({ ...validCsvRow, amount_usd: '3000' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount_usd).toBe(3000);
  });

  it('treats blank amount_usd as null', () => {
    const result = ScholarshipCsvRowSchema.safeParse({ ...validCsvRow, amount_usd: '' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount_usd).toBeNull();
  });

  it('fails when amount_usd is a negative number', () => {
    expect(ScholarshipCsvRowSchema.safeParse({ ...validCsvRow, amount_usd: '-500' }).success).toBe(false);
  });

  it('fails when amount_usd is not a number', () => {
    expect(ScholarshipCsvRowSchema.safeParse({ ...validCsvRow, amount_usd: 'abc' }).success).toBe(false);
  });

  it('trims deadline_text, converting blank to null', () => {
    const result = ScholarshipCsvRowSchema.safeParse({ ...validCsvRow, deadline_text: '  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.deadline_text).toBeNull();
  });

  it('parses semesters from pipe-delimited CSV format', () => {
    const result = ScholarshipCsvRowSchema.safeParse({
      ...validCsvRow,
      semesters: 'Fall 2024:2024-09-01:',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.semesters).toHaveLength(1);
      expect(result.data.semesters[0].name).toBe('Fall 2024');
    }
  });

  it('treats missing semesters as empty array', () => {
    const result = ScholarshipCsvRowSchema.safeParse(validCsvRow);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.semesters).toEqual([]);
  });

  it('defaults description fields to empty string', () => {
    const result = ScholarshipCsvRowSchema.safeParse(validCsvRow);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description_en).toBe('');
      expect(result.data.description_ru).toBe('');
      expect(result.data.description_tk).toBe('');
    }
  });

  it('trims application_url, converting blank to empty string', () => {
    const result = ScholarshipCsvRowSchema.safeParse({ ...validCsvRow, application_url: '  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.application_url).toBe('');
  });
});
