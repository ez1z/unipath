import { describe, expect, test } from 'vitest';
import {
  addDays,
  daysBetween,
  isIsoDate,
  isScholarshipOpen,
  todayIn,
} from '../../src/lib/dates.ts';

describe('dates', () => {
  test('today is the date in Ashgabat (UTC+5)', () => {
    // 20:30 UTC on 31 Dec is already 1 Jan in Ashgabat.
    expect(todayIn(undefined, new Date('2026-12-31T20:30:00Z'))).toBe('2027-01-01');
    expect(todayIn(undefined, new Date('2026-12-31T18:30:00Z'))).toBe('2026-12-31');
    expect(todayIn('UTC', new Date('2026-12-31T20:30:00Z'))).toBe('2026-12-31');
  });

  test('addDays crosses months, years and leap days', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  test('daysBetween', () => {
    expect(daysBetween('2026-12-01', '2026-12-31')).toBe(30);
    expect(daysBetween('2026-12-31', '2026-12-01')).toBe(-30);
    expect(daysBetween('2026-12-01', '2026-12-01')).toBe(0);
  });

  test('isIsoDate accepts real dates only', () => {
    expect(isIsoDate('2026-12-01')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-1-1')).toBe(false);
    expect(isIsoDate('tomorrow')).toBe(false);
  });
});

describe('scholarship open or closed', () => {
  const today = '2026-12-01';

  test('open until and including the deadline day', () => {
    expect(isScholarshipOpen({ deadline: '2026-12-01', rolling: false }, today)).toBe(true);
    expect(isScholarshipOpen({ deadline: '2026-11-30', rolling: false }, today)).toBe(false);
  });

  test('rolling or no confirmed deadline counts as open', () => {
    expect(isScholarshipOpen({ deadline: null, rolling: true }, today)).toBe(true);
    expect(isScholarshipOpen({ deadline: null, rolling: false }, today)).toBe(true);
    expect(isScholarshipOpen({ deadline: '2026-01-01', rolling: true }, today)).toBe(true);
  });
});
