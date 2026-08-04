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
