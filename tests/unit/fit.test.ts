import { describe, it, expect } from 'vitest';
import { suggestTier, getTestEntries, type FitProfile } from '@/lib/data/fit';
import type { University } from '@/lib/data/university-types';

function uni(overrides: Partial<University> = {}): University {
  return {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    slug: 'test-university',
    name: { en: 'Test University', ru: 'Тест', tk: 'Test' },
    country: 'Turkey',
    city: 'Ankara',
    tuition_usd: 5000,
    tuition_usd_max: null,
    acceptance_rate_min: null,
    acceptance_rate_max: null,
    moe_approved: true,
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

const withTests = (tests: unknown[]) => uni({ entrance_requirements: { tests } });

describe('getTestEntries', () => {
  it('returns the tests array from a requirements blob', () => {
    const entries = getTestEntries({ tests: [{ type: 'toefl', min_score: 80 }] });
    expect(entries).toEqual([{ type: 'toefl', min_score: 80 }]);
  });

  it('returns an empty array when there is no tests key', () => {
    expect(getTestEntries({})).toEqual([]);
    expect(getTestEntries(null)).toEqual([]);
    expect(getTestEntries(undefined)).toEqual([]);
  });

  it('ignores a tests key that is not an array', () => {
    expect(getTestEntries({ tests: 'toefl 80' })).toEqual([]);
  });

  it('drops entries that name no recognised test', () => {
    // entrance_requirements arrives as admin-authored JSON with no shape
    // validation on the CSV path, so these genuinely reach the database.
    expect(getTestEntries({ tests: [{ foo: 1 }, null, 'ielts', { type: 'gre' }] })).toEqual([]);
  });

  it('keeps the good entries alongside the bad ones', () => {
    const entries = getTestEntries({ tests: [{ foo: 1 }, { type: 'ielts', min_score: 6 }] });
    expect(entries).toEqual([{ type: 'ielts', min_score: 6 }]);
  });
});

describe('suggestTier — malformed requirements', () => {
  it('raises no flag for an entry naming no recognised test', () => {
    // Regression guard: a flag built from such an entry carries `test:
    // undefined`, and rendering one calls `.toUpperCase()` on it — which would
    // take down the whole list page for one bad import.
    const school = withTests([{ foo: 1 }, { type: 'gre', min_score: 320 }]);
    expect(suggestTier(school, {}).flags).toEqual([]);
  });

  it('still flags the valid entries beside a malformed one', () => {
    const school = withTests([{ foo: 1 }, { type: 'toefl', min_score: 80 }]);
    expect(suggestTier(school, {}).flags).toEqual([
      { code: 'test_required_missing', test: 'toefl', required: 80 },
    ]);
  });
});

describe('suggestTier — thin data yields no verdict', () => {
  it('returns no tier when there is no profile at all', () => {
    expect(suggestTier(uni(), null).tier).toBeNull();
  });

  it('returns no tier when only one signal is available', () => {
    const profile: FitProfile = { toefl_total: 90 };
    const result = suggestTier(withTests([{ type: 'toefl', min_score: 80 }]), profile);
    expect(result.tier).toBeNull();
  });

  it('returns no tier when the university states requirements the student has not filled in', () => {
    const school = withTests([{ type: 'toefl', min_score: 80 }, { type: 'sat', min_math: 600, min_verbal: 600 }]);
    expect(suggestTier(school, {}).tier).toBeNull();
  });

  it('still reports factual flags when no tier can be suggested', () => {
    const result = suggestTier(uni({ moe_approved: false }), null);
    expect(result.tier).toBeNull();
    expect(result.flags).toContainEqual({ code: 'not_moe_approved' });
  });
});

describe('suggestTier — reaches', () => {
  it('suggests dream when a stated test minimum is missed', () => {
    const school = withTests([{ type: 'toefl', min_score: 90 }]);
    const result = suggestTier(school, { toefl_total: 70, budget_usd: 20000 });
    expect(result.tier).toBe('dream');
  });

  it('suggests dream when tuition is far past the budget', () => {
    const school = uni({ tuition_usd: 30000, acceptance_rate_min: 60 });
    expect(suggestTier(school, { budget_usd: 10000 }).tier).toBe('dream');
  });

  it('suggests dream for a highly selective school even when requirements are met', () => {
    const school = withTests([{ type: 'toefl', min_score: 80 }]);
    school.acceptance_rate_min = 8;
    expect(suggestTier(school, { toefl_total: 110, budget_usd: 50000 }).tier).toBe('dream');
  });
});

describe('suggestTier — safety and target', () => {
  it('suggests safety when requirements are met at an open-admission school within budget', () => {
    const school = withTests([{ type: 'toefl', min_score: 70 }]);
    school.acceptance_rate_min = 75;
    expect(suggestTier(school, { toefl_total: 100, budget_usd: 20000 }).tier).toBe('safety');
  });

  it('suggests target when requirements are met but admission is neither open nor selective', () => {
    const school = withTests([{ type: 'toefl', min_score: 70 }]);
    school.acceptance_rate_min = 35;
    expect(suggestTier(school, { toefl_total: 100, budget_usd: 20000 }).tier).toBe('target');
  });

  it('does not call a school a safety when it is over budget', () => {
    const school = uni({ tuition_usd: 12000, acceptance_rate_min: 80 });
    const result = suggestTier(school, { budget_usd: 10000 });
    expect(result.tier).toBe('target');
  });
});

describe('suggestTier — flags', () => {
  it('reports the test, the required score and the student score', () => {
    const school = withTests([{ type: 'ielts', min_score: 6.5 }]);
    const result = suggestTier(school, { ielts_overall: 5.5, budget_usd: 20000 });
    expect(result.flags).toContainEqual({
      code: 'test_below_min',
      test: 'ielts',
      required: 6.5,
      yours: 5.5,
    });
  });

  it('sums SAT section minimums into one required total', () => {
    const school = withTests([{ type: 'sat', min_math: 600, min_verbal: 650 }]);
    const result = suggestTier(school, { sat_total: 1200, budget_usd: 20000 });
    expect(result.flags).toContainEqual({
      code: 'test_below_min',
      test: 'sat',
      required: 1250,
      yours: 1200,
    });
  });

  it('flags over budget with both figures', () => {
    const school = uni({ tuition_usd: 11000, acceptance_rate_min: 50 });
    const result = suggestTier(school, { budget_usd: 10000 });
    expect(result.flags).toContainEqual({ code: 'over_budget', required: 11000, yours: 10000 });
  });

  it('flags a highly selective school', () => {
    const school = uni({ acceptance_rate_min: 5 });
    expect(suggestTier(school, { budget_usd: 50000 }).flags).toContainEqual({
      code: 'highly_selective',
      rate: 5,
    });
  });

  it('raises no flags for a school that meets everything', () => {
    const school = withTests([{ type: 'toefl', min_score: 70 }]);
    school.acceptance_rate_min = 60;
    expect(suggestTier(school, { toefl_total: 100, budget_usd: 20000 }).flags).toEqual([]);
  });

  it('ignores a test the university states no minimum for', () => {
    const school = withTests([{ type: 'toefl' }]);
    const result = suggestTier(school, { toefl_total: 10, budget_usd: 20000 });
    expect(result.flags).toEqual([]);
  });
});

describe('suggestTier — a required test the student has no score for', () => {
  it('flags the missing score with the minimum the university asks for', () => {
    const school = withTests([{ type: 'toefl', min_score: 80 }]);
    expect(suggestTier(school, { budget_usd: 20000 }).flags).toContainEqual({
      code: 'test_required_missing',
      test: 'toefl',
      required: 80,
    });
  });

  it('flags a test named without a published minimum, with a null requirement', () => {
    const school = withTests([{ type: 'ielts' }]);
    expect(suggestTier(school, { budget_usd: 20000 }).flags).toContainEqual({
      code: 'test_required_missing',
      test: 'ielts',
      required: null,
    });
  });

  it('reports the SAT requirement as one summed total', () => {
    const school = withTests([{ type: 'sat', min_math: 600, min_verbal: 650 }]);
    expect(suggestTier(school, { budget_usd: 20000 }).flags).toContainEqual({
      code: 'test_required_missing',
      test: 'sat',
      required: 1250,
    });
  });

  it('flags every required test the student is missing, not just the first', () => {
    const school = withTests([
      { type: 'toefl', min_score: 80 },
      { type: 'sat', min_math: 600, min_verbal: 600 },
    ]);
    const codes = suggestTier(school, {}).flags.map((f) => f.code);
    expect(codes).toEqual(['test_required_missing', 'test_required_missing']);
  });

  it('does not flag a test the student has a score for', () => {
    const school = withTests([{ type: 'toefl', min_score: 80 }]);
    const flags = suggestTier(school, { toefl_total: 100, budget_usd: 20000 }).flags;
    expect(flags.some((f) => f.code === 'test_required_missing')).toBe(false);
  });

  it('is not a signal — a missing score cannot produce a tier on its own', () => {
    // Two stated requirements and an acceptance rate would be two signals if
    // absent scores counted; they must not, because nothing is known yet.
    const school = withTests([
      { type: 'toefl', min_score: 80 },
      { type: 'ielts', min_score: 6.5 },
    ]);
    school.acceptance_rate_min = 60;
    expect(suggestTier(school, {}).tier).toBeNull();
  });

  it('does not change the tier for a student who has the scores', () => {
    const school = withTests([{ type: 'toefl', min_score: 70 }]);
    school.acceptance_rate_min = 75;
    expect(suggestTier(school, { toefl_total: 100, budget_usd: 20000 }).tier).toBe('safety');
  });
});

describe('suggestTier — signed-out students', () => {
  it('reports required tests with no profile at all', () => {
    const school = withTests([{ type: 'toefl', min_score: 80 }]);
    expect(suggestTier(school, null).flags).toContainEqual({
      code: 'test_required_missing',
      test: 'toefl',
      required: 80,
    });
  });

  it('still suggests no tier without a profile', () => {
    const school = withTests([{ type: 'toefl', min_score: 80 }]);
    school.acceptance_rate_min = 60;
    expect(suggestTier(school, null).tier).toBeNull();
  });

  it('raises nothing for a university that states no tests', () => {
    expect(suggestTier(uni(), null).flags).toEqual([]);
  });
});
