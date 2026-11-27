import { describe, expect, test } from 'vitest';
import { shortestTotalYears } from '../../src/lib/db/queries.ts';
import {
  directEntry,
  isPreYear,
  lengthBucket,
  LENGTH_BUCKET_RANGES,
  LENGTH_BUCKETS,
  pathwayErrors,
  totalYears,
} from '../../src/lib/paths.ts';
import { PROGRAM_LEVELS } from '../../src/lib/db/values.ts';

describe('total years', () => {
  test('is the pre-year plus the bachelor’s', () => {
    expect(totalYears(1, 3)).toBe(4);
    expect(totalYears(1, 4)).toBe(5);
    expect(totalYears(1, 6)).toBe(7);
  });

  test('is the bachelor’s alone on direct entry', () => {
    expect(totalYears(null, 4)).toBe(4);
    expect(totalYears(null, 3.5)).toBe(3.5);
  });

  test('handles half years without floating-point noise', () => {
    expect(totalYears(0.5, 3.5)).toBe(4);
    expect(totalYears(1.5, 3.5)).toBe(5);
    expect(totalYears(0.1, 0.2)).toBe(0.3);
  });
});

describe('shortest total years through a program', () => {
  const bachelor = (durationYears: number, preYearRequired: 'yes' | 'no' | 'unknown') => ({
    level: 'bachelor' as const,
    durationYears,
    preYearRequired,
  });

  test('direct entry counts unless a pre-year is required', () => {
    expect(shortestTotalYears(bachelor(4, 'no'), null, null)).toBe(4);
    expect(shortestTotalYears(bachelor(4, 'unknown'), null, null)).toBe(4);
    expect(shortestTotalYears(bachelor(4, 'yes'), null, null)).toBeNull();
  });

  test('a required pre-year adds its length', () => {
    expect(shortestTotalYears(bachelor(3, 'yes'), 1, null)).toBe(4);
  });

  test('takes the shorter of direct entry and a pathway', () => {
    expect(shortestTotalYears(bachelor(3.5, 'no'), 1, null)).toBe(3.5);
  });

  test('a pre-year program adds the shortest bachelor’s it leads to', () => {
    const foundation = { level: 'foundation' as const, durationYears: 1, preYearRequired: null };
    expect(shortestTotalYears(foundation, null, 3)).toBe(4);
    expect(shortestTotalYears(foundation, null, null)).toBeNull();
  });
});

describe('pathway rules', () => {
  test('from must be a pre-year (foundation or language), to must be a bachelor’s', () => {
    expect(pathwayErrors({ level: 'foundation' }, { level: 'bachelor' })).toEqual([]);
    expect(pathwayErrors({ level: 'language' }, { level: 'bachelor' })).toEqual([]);
  });

  test('every other combination is rejected', () => {
    for (const from of PROGRAM_LEVELS) {
      for (const to of PROGRAM_LEVELS) {
        const valid = (from === 'foundation' || from === 'language') && to === 'bachelor';
        expect(pathwayErrors({ level: from }, { level: to }).length === 0, `${from} → ${to}`).toBe(
          valid,
        );
      }
    }
    expect(pathwayErrors({ level: 'bachelor' }, { level: 'foundation' })).toEqual([
      'from_not_pre_year',
      'to_not_bachelor',
    ]);
    expect(pathwayErrors({ level: 'foundation' }, { level: 'language' })).toEqual([
      'to_not_bachelor',
    ]);
  });

  test('isPreYear', () => {
    expect(isPreYear('foundation')).toBe(true);
    expect(isPreYear('language')).toBe(true);
    expect(isPreYear('bachelor')).toBe(false);
  });
});

describe('direct entry', () => {
  test('is the inverse of pre_year_required, and unknown stays unknown', () => {
    expect(directEntry('yes')).toBe('no');
    expect(directEntry('no')).toBe('yes');
    expect(directEntry('unknown')).toBe('unknown');
  });
});

describe('bachelor’s length buckets', () => {
  test('3 covers 3 and 3.5 years, 4 covers 4 and 4.5, 5+ the rest', () => {
    expect([3, 3.5, 4, 4.5, 5, 6].map(lengthBucket)).toEqual(['3', '3', '4', '4', '5+', '5+']);
  });

  test('the SQL ranges agree with lengthBucket', () => {
    for (const years of [2, 3, 3.5, 3.99, 4, 4.5, 4.99, 5, 6, 7]) {
      const matching = LENGTH_BUCKETS.filter((bucket) => {
        const [min, max] = LENGTH_BUCKET_RANGES[bucket];
        return (min === null || years >= min) && (max === null || years < max);
      });
      expect(matching, `${years} years`).toEqual([lengthBucket(years)]);
    }
  });
});
