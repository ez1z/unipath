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

const TEST_TYPES: readonly TestType[] = ['toefl', 'ielts', 'sat', 'duolingo'];

/**
 * Pull the standardized-test entries out of an entrance_requirements /
 * requirements blob.
 *
 * `entrance_requirements` is admin-authored JSON that reaches the database
 * through a bare `JSON.parse` on the CSV path, so an entry naming no recognised
 * test genuinely can be stored. Dropping those here rather than downstream is
 * what lets every consumer — the fit flags, the requirements summary — trust
 * `type` without re-checking it, and keeps one bad row from taking a page down.
 */
export function getTestEntries(
  requirements: Record<string, unknown> | null | undefined,
): TestEntry[] {
  if (!Array.isArray(requirements?.tests)) return [];

  return (requirements.tests as unknown[]).filter(
    (entry): entry is TestEntry =>
      typeof entry === 'object' &&
      entry !== null &&
      (TEST_TYPES as readonly string[]).includes((entry as { type?: unknown }).type as string),
  );
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
  /** The university asks for this test and the student has recorded no score.
   *  `required` is null when the university names the test but states no minimum. */
  | { code: 'test_required_missing'; test: TestType; required: number | null }
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
 *
 * Flags are not held to that bar, because they state facts rather than draw
 * conclusions: they are reported even with no profile at all, which is what
 * makes them useful to a signed-out student.
 */
export function suggestTier(uni: University, profile: FitProfile | null): FitResult {
  const flags: FitFlag[] = [];

  if (!uni.moe_approved) flags.push({ code: 'not_moe_approved' });

  if (uni.acceptance_rate_min != null && uni.acceptance_rate_min < SELECTIVE_RATE) {
    flags.push({ code: 'highly_selective', rate: uni.acceptance_rate_min });
  }

  // A missing profile is treated as an empty one rather than an early exit, so
  // the factual flags below still reach a signed-out student. It cannot change
  // the verdict: an empty profile offers no test score and no budget, leaving
  // the acceptance rate as the only possible signal — one short of the two
  // `signals` requires.
  const student = profile ?? {};

  let signals = 0;
  let missedTest = false;

  for (const test of getTestEntries(uni.entrance_requirements)) {
    const required = minimumFor(test);
    const yours = scoreFor(test.type, student);

    // The university asks for this test and the student has no score on file.
    // That is a gap in the profile, not a shortfall in the application, so it
    // is reported but deliberately not counted as a signal: inferring a tier
    // from an absent score is the false confidence this function avoids
    // everywhere else. Worth saying even when no minimum is published — that
    // the test is needed at all is the part the student has to act on.
    if (yours == null) {
      flags.push({ code: 'test_required_missing', test: test.type, required });
      continue;
    }

    if (required == null) continue;

    signals++;
    if (yours < required) {
      missedTest = true;
      flags.push({ code: 'test_below_min', test: test.type, required, yours });
    }
  }

  let farOverBudget = false;
  let overBudget = false;
  if (student.budget_usd != null && student.budget_usd > 0) {
    signals++;
    if (uni.tuition_usd > student.budget_usd) {
      overBudget = true;
      farOverBudget = uni.tuition_usd > student.budget_usd * BUDGET_REACH_MULTIPLIER;
      flags.push({ code: 'over_budget', required: uni.tuition_usd, yours: student.budget_usd });
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
