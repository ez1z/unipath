import type { University } from './university-types';

export type TestEntry = { type: string; min_score?: number; min_math?: number; min_verbal?: number };

export type UserScores = {
  toefl: number | null;
  ielts: number | null;
  sat: number | null;
  duolingo: number | null;
};

/** Anything with entrance requirements: a full `University` or a slim list item. */
type WithRequirements = Pick<University, 'entrance_requirements'>;

export function testsOf(university: WithRequirements): TestEntry[] {
  return Array.isArray(university.entrance_requirements?.tests)
    ? (university.entrance_requirements.tests as TestEntry[])
    : [];
}

// True when the scores meet at least one of the listed tests (or none are listed).
export function meetsTests(tests: TestEntry[], scores: UserScores): boolean {
  if (tests.length === 0) return true;
  return tests.some((test) => {
    if (test.type === 'toefl') return scores.toefl != null && scores.toefl >= (test.min_score ?? 0);
    if (test.type === 'ielts') return scores.ielts != null && scores.ielts >= (test.min_score ?? 0);
    if (test.type === 'sat') {
      if (scores.sat == null) return false;
      return scores.sat >= (test.min_math ?? 0) + (test.min_verbal ?? 0);
    }
    if (test.type === 'duolingo') return scores.duolingo != null && scores.duolingo >= (test.min_score ?? 0);
    return false;
  });
}

export function meetsTestRequirements(university: WithRequirements, scores: UserScores): boolean {
  return meetsTests(testsOf(university), scores);
}

export function hasAnyScore(scores: UserScores | null): scores is UserScores {
  return (
    scores !== null &&
    (scores.toefl != null || scores.ielts != null || scores.sat != null || scores.duolingo != null)
  );
}
