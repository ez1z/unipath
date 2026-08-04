import type { University } from '@/lib/data/university-types';
import type { Tier } from '@/lib/data/list-types';

export type TestType = 'toefl' | 'ielts' | 'sat' | 'duolingo';

export type TestEntry = {
  type: TestType;
  format?: 'ibt' | 'pbt';
  min_score?: number;
  min_math?: number;
  min_verbal?: number;
};

/** Pull the standardized-test entries out of an entrance_requirements / requirements blob. */
export function getTestEntries(
  requirements: Record<string, unknown> | null | undefined,
): TestEntry[] {
  return Array.isArray(requirements?.tests) ? (requirements!.tests as TestEntry[]) : [];
}

/** The subset of the profile row the fit calculation reads. */
export type FitProfile = {
  toefl_total?: number | null;
  ielts_overall?: number | null;
  sat_total?: number | null;
  duolingo_score?: number | null;
  budget_usd?: number | null;
};

export type FitFlag =
  | { code: 'test_below_min'; test: TestType; required: number; yours: number }
  | { code: 'over_budget'; required: number; yours: number }
  | { code: 'not_moe_approved' }
  | { code: 'highly_selective'; rate: number };

export type FitResult = { tier: Tier | null; flags: FitFlag[] };

/** Below this acceptance rate a school is a reach even for a strong applicant. */
const SELECTIVE_RATE = 20;
/** Above this, admission is broad enough that meeting the bar makes it a safety. */
const OPEN_RATE = 50;
/** Tuition this far past the stated budget is a different kind of problem than "a bit pricey". */
const BUDGET_REACH_MULTIPLIER = 1.5;

/** A university's own minimum for a given test, or null when it states none. */
function minimumFor(test: TestEntry): number | null {
  if (test.type === 'sat') {
    const total = (test.min_math ?? 0) + (test.min_verbal ?? 0);
    if (total > 0) return total;
  }
  return test.min_score ?? null;
}

function scoreFor(test: TestType, profile: FitProfile): number | null {
  switch (test) {
    case 'toefl':
      return profile.toefl_total ?? null;
    case 'ielts':
      return profile.ielts_overall ?? null;
    case 'sat':
      return profile.sat_total ?? null;
    case 'duolingo':
      return profile.duolingo_score ?? null;
  }
}

/**
 * Suggest a dream/target/safety tier by comparing the student's profile against
 * what the university actually states.
 *
 * The data behind this is uneven — many universities list no test minimums and
 * many students have not filled in their scores — so the output is deliberately
 * coarse, and when fewer than two signals are available it returns no tier at
 * all. A blank suggestion is honest; a confident one built on a single data
 * point would be worse than silence, because students act on these labels.
 */
export function suggestTier(uni: University, profile: FitProfile | null): FitResult {
  const flags: FitFlag[] = [];

  if (!uni.moe_approved) flags.push({ code: 'not_moe_approved' });

  if (uni.acceptance_rate_min != null && uni.acceptance_rate_min < SELECTIVE_RATE) {
    flags.push({ code: 'highly_selective', rate: uni.acceptance_rate_min });
  }

  if (!profile) return { tier: null, flags };

  let signals = 0;
  let missedTest = false;

  for (const test of getTestEntries(uni.entrance_requirements)) {
    const required = minimumFor(test);
    const yours = scoreFor(test.type, profile);
    if (required == null || yours == null) continue;

    signals++;
    if (yours < required) {
      missedTest = true;
      flags.push({ code: 'test_below_min', test: test.type, required, yours });
    }
  }

  let farOverBudget = false;
  let overBudget = false;
  if (profile.budget_usd != null && profile.budget_usd > 0) {
    signals++;
    if (uni.tuition_usd > profile.budget_usd) {
      overBudget = true;
      farOverBudget = uni.tuition_usd > profile.budget_usd * BUDGET_REACH_MULTIPLIER;
      flags.push({ code: 'over_budget', required: uni.tuition_usd, yours: profile.budget_usd });
    }
  }

  if (uni.acceptance_rate_min != null) signals++;

  if (signals < 2) return { tier: null, flags };

  if (missedTest || farOverBudget) return { tier: 'dream', flags };

  const selective = uni.acceptance_rate_min != null && uni.acceptance_rate_min < SELECTIVE_RATE;
  if (selective) return { tier: 'dream', flags };

  const open = uni.acceptance_rate_min != null && uni.acceptance_rate_min >= OPEN_RATE;
  if (!overBudget && open) return { tier: 'safety', flags };

  return { tier: 'target', flags };
}
