import { describe, it, expect } from 'vitest';
import { parseSemestersJson, parseSemestersCsv } from '@/lib/types/semester';

describe('parseSemestersJson', () => {
  it('returns empty array for non-array input', () => {
    expect(parseSemestersJson(null)).toEqual([]);
    expect(parseSemestersJson(undefined)).toEqual([]);
    expect(parseSemestersJson('string')).toEqual([]);
    expect(parseSemestersJson({})).toEqual([]);
  });

  it('returns empty array for empty array', () => {
    expect(parseSemestersJson([])).toEqual([]);
  });

  it('parses a valid semester with null deadline', () => {
    const input = [{ name: 'Fall 2024', start_date: '2024-09-01', deadline: null }];
    expect(parseSemestersJson(input)).toEqual([
      { ...input[0], language: null, major: null },
    ]);
  });

  it('parses a valid semester with a deadline', () => {
    const input = [{ name: 'Spring 2025', start_date: '2025-01-15', deadline: '2024-11-30' }];
    expect(parseSemestersJson(input)).toEqual([
      { ...input[0], language: null, major: null },
    ]);
  });

  it('parses multiple valid semesters', () => {
    const input = [
      { name: 'Fall 2024', start_date: '2024-09-01', deadline: null },
      { name: 'Spring 2025', start_date: '2025-01-15', deadline: '2024-11-30' },
    ];
    expect(parseSemestersJson(input)).toHaveLength(2);
  });

  it('filters out entries with invalid start_date format', () => {
    const input = [
      { name: 'Bad', start_date: '09-01-2024', deadline: null },
      { name: 'Good', start_date: '2024-09-01', deadline: null },
    ];
    expect(parseSemestersJson(input)).toHaveLength(1);
    expect(parseSemestersJson(input)[0].name).toBe('Good');
  });

  it('filters out entries with invalid deadline format', () => {
    const input = [{ name: 'Bad', start_date: '2024-09-01', deadline: '01/01/2024' }];
    expect(parseSemestersJson(input)).toHaveLength(0);
  });

  it('filters out entries missing required fields', () => {
    const input = [
      { start_date: '2024-09-01', deadline: null },
      { name: 'No Date', deadline: null },
    ];
    expect(parseSemestersJson(input)).toHaveLength(0);
  });

  it('filters out non-object entries', () => {
    expect(parseSemestersJson(['string', 42, null])).toHaveLength(0);
  });
});

describe('parseSemestersCsv', () => {
  it('returns empty array for empty string', () => {
    expect(parseSemestersCsv('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(parseSemestersCsv('   ')).toEqual([]);
  });

  it('parses a single segment without deadline', () => {
    const result = parseSemestersCsv('Fall 2024:2024-09-01:');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Fall 2024', start_date: '2024-09-01', deadline: null });
  });

  it('parses a single segment with a deadline', () => {
    const result = parseSemestersCsv('Spring 2025:2025-01-15:2024-11-30');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: 'Spring 2025', start_date: '2025-01-15', deadline: '2024-11-30' });
  });

  it('parses multiple pipe-separated segments', () => {
    const result = parseSemestersCsv('Fall 2024:2024-09-01:|Spring 2025:2025-01-15:2024-11-30');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Fall 2024');
    expect(result[1].name).toBe('Spring 2025');
  });

  it('filters out segments with invalid start_date format', () => {
    const result = parseSemestersCsv('Bad:09-01-2024:|Good:2024-09-01:');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Good');
  });

  it('treats missing deadline (no third colon) as null', () => {
    const result = parseSemestersCsv('Fall 2024:2024-09-01');
    expect(result).toHaveLength(1);
    expect(result[0].deadline).toBeNull();
  });

  it('trims whitespace from segment parts', () => {
    const result = parseSemestersCsv(' Fall 2024 : 2024-09-01 : ');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Fall 2024');
    expect(result[0].start_date).toBe('2024-09-01');
    expect(result[0].deadline).toBeNull();
  });
});
