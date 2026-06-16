import { describe, it, expect } from 'vitest';
import { ProfileSchema } from '@/lib/data/profile-schema';

describe('ProfileSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(ProfileSchema.safeParse({}).success).toBe(true);
  });

  describe('display_name', () => {
    it('accepts a valid display name', () => {
      expect(ProfileSchema.safeParse({ display_name: 'Alice' }).success).toBe(true);
    });

    it('fails when display_name exceeds 80 characters', () => {
      expect(ProfileSchema.safeParse({ display_name: 'a'.repeat(81) }).success).toBe(false);
    });

    it('accepts exactly 80 characters', () => {
      expect(ProfileSchema.safeParse({ display_name: 'a'.repeat(80) }).success).toBe(true);
    });

    it('accepts null', () => {
      expect(ProfileSchema.safeParse({ display_name: null }).success).toBe(true);
    });
  });

  describe('toefl_total', () => {
    it('accepts valid range 0–120', () => {
      expect(ProfileSchema.safeParse({ toefl_total: 0 }).success).toBe(true);
      expect(ProfileSchema.safeParse({ toefl_total: 120 }).success).toBe(true);
      expect(ProfileSchema.safeParse({ toefl_total: 90 }).success).toBe(true);
    });

    it('fails below 0', () => {
      expect(ProfileSchema.safeParse({ toefl_total: -1 }).success).toBe(false);
    });

    it('fails above 120', () => {
      expect(ProfileSchema.safeParse({ toefl_total: 121 }).success).toBe(false);
    });

    it('coerces a numeric string', () => {
      const result = ProfileSchema.safeParse({ toefl_total: '100' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.toefl_total).toBe(100);
    });
  });

  describe('ielts_overall', () => {
    it('accepts values in 0.5 increments within 0–9', () => {
      expect(ProfileSchema.safeParse({ ielts_overall: 0 }).success).toBe(true);
      expect(ProfileSchema.safeParse({ ielts_overall: 6.5 }).success).toBe(true);
      expect(ProfileSchema.safeParse({ ielts_overall: 9 }).success).toBe(true);
    });

    it('fails for non-0.5 increments', () => {
      expect(ProfileSchema.safeParse({ ielts_overall: 6.3 }).success).toBe(false);
      expect(ProfileSchema.safeParse({ ielts_overall: 7.1 }).success).toBe(false);
    });

    it('fails above 9', () => {
      expect(ProfileSchema.safeParse({ ielts_overall: 9.5 }).success).toBe(false);
    });
  });

  describe('sat_total', () => {
    it('accepts valid range 400–1600', () => {
      expect(ProfileSchema.safeParse({ sat_total: 400 }).success).toBe(true);
      expect(ProfileSchema.safeParse({ sat_total: 1600 }).success).toBe(true);
    });

    it('fails below 400', () => {
      expect(ProfileSchema.safeParse({ sat_total: 399 }).success).toBe(false);
    });

    it('fails above 1600', () => {
      expect(ProfileSchema.safeParse({ sat_total: 1601 }).success).toBe(false);
    });
  });

  describe('duolingo_score', () => {
    it('accepts valid range 10–160', () => {
      expect(ProfileSchema.safeParse({ duolingo_score: 10 }).success).toBe(true);
      expect(ProfileSchema.safeParse({ duolingo_score: 160 }).success).toBe(true);
    });

    it('fails below 10', () => {
      expect(ProfileSchema.safeParse({ duolingo_score: 9 }).success).toBe(false);
    });

    it('fails above 160', () => {
      expect(ProfileSchema.safeParse({ duolingo_score: 161 }).success).toBe(false);
    });
  });

  describe('gpa', () => {
    it('accepts valid range 0–100', () => {
      expect(ProfileSchema.safeParse({ gpa: 0 }).success).toBe(true);
      expect(ProfileSchema.safeParse({ gpa: 100 }).success).toBe(true);
      expect(ProfileSchema.safeParse({ gpa: 3.8 }).success).toBe(true);
    });

    it('fails above 100', () => {
      expect(ProfileSchema.safeParse({ gpa: 100.1 }).success).toBe(false);
    });
  });

  describe('gpa_scale', () => {
    it('defaults to 4.0 when not provided', () => {
      const result = ProfileSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.gpa_scale).toBe('4.0');
    });

    it('accepts all valid gpa_scale values', () => {
      for (const scale of ['4.0', '5.0', '100-point']) {
        expect(ProfileSchema.safeParse({ gpa_scale: scale }).success).toBe(true);
      }
    });

    it('fails for invalid gpa_scale', () => {
      expect(ProfileSchema.safeParse({ gpa_scale: '10.0' }).success).toBe(false);
    });
  });

  describe('array fields', () => {
    it('desired_countries defaults to empty array', () => {
      const result = ProfileSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.desired_countries).toEqual([]);
    });

    it('accepts valid string arrays for desired_countries and desired_majors', () => {
      const result = ProfileSchema.safeParse({
        desired_countries: ['Turkey', 'Germany'],
        desired_majors: ['CS', 'Medicine'],
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid UUID arrays for dream_university_ids', () => {
      const result = ProfileSchema.safeParse({
        dream_university_ids: ['550e8400-e29b-41d4-a716-446655440000'],
      });
      expect(result.success).toBe(true);
    });

    it('fails when dream_university_ids contains non-UUID strings', () => {
      const result = ProfileSchema.safeParse({ dream_university_ids: ['not-a-uuid'] });
      expect(result.success).toBe(false);
    });
  });

  describe('budget_usd', () => {
    it('accepts zero', () => {
      expect(ProfileSchema.safeParse({ budget_usd: 0 }).success).toBe(true);
    });

    it('accepts positive values', () => {
      expect(ProfileSchema.safeParse({ budget_usd: 10000 }).success).toBe(true);
    });

    it('fails for negative values', () => {
      expect(ProfileSchema.safeParse({ budget_usd: -1 }).success).toBe(false);
    });

    it('accepts null', () => {
      expect(ProfileSchema.safeParse({ budget_usd: null }).success).toBe(true);
    });
  });
});
