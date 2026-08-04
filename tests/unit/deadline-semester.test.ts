import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveSemester, semesterKey, getNearestDeadline } from '@/lib/data/deadline';
import type { Semester } from '@/lib/types/semester';

const TODAY = new Date('2026-08-05T12:00:00Z');

const semester = (name: string, start: string, deadline: string | null): Semester => ({
  name,
  start_date: start,
  deadline,
  language: null,
  major: null,
});

const FALL_26 = semester('Fall 2026', '2026-09-15', '2026-08-25');
const SPRING_27 = semester('Spring 2027', '2027-02-01', '2026-12-01');
const FALL_27 = semester('Fall 2027', '2027-09-15', null);
const PASSED = semester('Fall 2025', '2025-09-15', '2025-07-01');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('semesterKey', () => {
  it('pairs the name with the start date', () => {
    expect(semesterKey(FALL_26)).toBe('Fall 2026|2026-09-15');
  });

  /**
   * The reason a name alone will not do: a university can list the same intake
   * twice, once per language of instruction.
   */
  it('distinguishes two intakes that share a name but not a start date', () => {
    const english = semester('Fall 2026', '2026-09-15', '2026-08-25');
    const turkmen = semester('Fall 2026', '2026-10-01', '2026-09-10');
    expect(semesterKey(english)).not.toBe(semesterKey(turkmen));
  });
});

describe('resolveSemester — no choice made', () => {
  it('falls back to the nearest upcoming deadline', () => {
    const resolved = resolveSemester([SPRING_27, FALL_26], null);
    expect(resolved?.semester.name).toBe('Fall 2026');
  });

  it('agrees with getNearestDeadline when the key is null', () => {
    const semesters = [SPRING_27, FALL_26];
    expect(resolveSemester(semesters, null)).toEqual(getNearestDeadline(semesters));
  });

  it('returns null when the university has no dated semesters at all', () => {
    expect(resolveSemester([FALL_27], null)).toBeNull();
    expect(resolveSemester([], null)).toBeNull();
  });
});

describe('resolveSemester — the student chose', () => {
  it('honours the choice over the nearest deadline', () => {
    const resolved = resolveSemester([FALL_26, SPRING_27], semesterKey(SPRING_27));
    expect(resolved?.semester.name).toBe('Spring 2027');
  });

  it('counts the days to the chosen deadline, not the nearest one', () => {
    const resolved = resolveSemester([FALL_26, SPRING_27], semesterKey(SPRING_27));
    expect(resolved?.days).toBe(118);
  });

  it('reports null days for an intake with no published deadline', () => {
    const resolved = resolveSemester([FALL_26, FALL_27], semesterKey(FALL_27));
    expect(resolved?.semester.name).toBe('Fall 2027');
    expect(resolved?.days).toBeNull();
  });

  it('reports negative days for a chosen intake whose deadline has passed', () => {
    const resolved = resolveSemester([PASSED, FALL_26], semesterKey(PASSED));
    expect(resolved?.days).toBeLessThan(0);
  });

  /** A stored choice outlives the data it points at. */
  it('falls back to auto when the chosen semester no longer exists', () => {
    const resolved = resolveSemester([FALL_26], semesterKey(SPRING_27));
    expect(resolved?.semester.name).toBe('Fall 2026');
  });

  it('falls back to null when the choice is gone and nothing is dated', () => {
    expect(resolveSemester([FALL_27], semesterKey(SPRING_27))).toBeNull();
  });
});
