/**
 * "Matches for you" on Home: bachelor's programs that fit the four quick
 * questions (countries, field, budget per year, English test and score).
 *
 * The answers live in localStorage (and in the profile once signed in), so the
 * Home page stays the same for everyone and cached; the island asks
 * /[lang]/matches with the answers in the query. Those use the search page's
 * parameter names, so "See all matches" is a plain search link.
 */
import { sql } from 'drizzle-orm';
import * as z from 'zod';
import type { Lang } from '../i18n/config.ts';
import type { Db } from './db/client.ts';
import { searchPrograms, type ProgramCard } from './db/queries.ts';
import { programs, type QuizAnswers } from './db/schema.ts';
import { FIELDS, type Field } from './db/values.ts';
import {
  PARAM,
  parseProgramFilters,
  serializeProgramFilters,
  type ProgramFilters,
} from './search/filters.ts';

export const MATCHES_SHOWN = 6;
export const IELTS_PARAM = 'ielts';
/** Budget choices in the quick questions, USD per year. */
export const BUDGETS = [5_000, 10_000, 15_000, 25_000] as const;

export interface MatchQuery {
  countries: string[];
  field: Field | null;
  maxTuitionUsd: number | null;
  /** IELTS overall band; other tests don't narrow the list. */
  ielts: number | null;
}

const ielts = z.coerce.number().min(0).max(9).multipleOf(0.5);

export function parseMatchQuery(params: URLSearchParams): MatchQuery {
  const f = parseProgramFilters(params);
  const score = ielts.safeParse(params.get(IELTS_PARAM));
  return {
    countries: f.countries,
    field: f.fields[0] ?? null,
    maxTuitionUsd: f.tuitionMax,
    ielts: params.get(IELTS_PARAM) !== null && score.success ? score.data : null,
  };
}

/** The search filters behind the matches: bachelor's, plus the answers. */
export function matchFilters(q: MatchQuery): ProgramFilters {
  return {
    ...parseProgramFilters(new URLSearchParams()),
    levels: ['bachelor'],
    countries: q.countries,
    fields: q.field ? [q.field] : [],
    tuitionMax: q.maxTuitionUsd,
  };
}

/** Canonical query for /[lang]/matches (and its cache key). */
export function serializeMatchQuery(q: MatchQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of serializeProgramFilters(matchFilters(q))) {
    if (key !== PARAM.level) params.append(key, value);
  }
  if (q.ielts !== null) params.set(IELTS_PARAM, String(q.ielts));
  return params;
}

/** The same answers as a /search link ("See all matches"). */
export function searchQueryFor(q: MatchQuery): URLSearchParams {
  return serializeProgramFilters(matchFilters(q));
}

/** Quiz answers (profile / localStorage shape) to a match query. */
export function matchQueryFromQuiz(quiz: QuizAnswers): MatchQuery {
  const field = (FIELDS as readonly string[]).includes(quiz.field ?? '')
    ? (quiz.field as Field)
    : null;
  const score = quiz.englishTest?.name === 'IELTS' ? ielts.safeParse(quiz.englishTest.score) : null;
  return {
    countries: quiz.countries.slice(0, 12),
    field,
    maxTuitionUsd: quiz.budgetPerYearUsd,
    ielts: score?.success ? score.data : null,
  };
}

export async function findMatches(
  db: Db,
  q: MatchQuery,
  { lang, today }: { lang: Lang; today: string },
): Promise<{ items: ProgramCard[]; total: number }> {
  // A program asking for a higher IELTS band than the student has is not a match;
  // one with no IELTS requirement (or none confirmed) still is.
  const required = sql`json_extract(${programs.requirements}, '$.ieltsMin')`;
  const where =
    q.ielts === null ? undefined : sql`(${required} is null or ${required} <= ${q.ielts})`;
  const page = await searchPrograms(db, matchFilters(q), {
    lang,
    today,
    pageSize: MATCHES_SHOWN,
    where,
  });
  return { items: page.items, total: page.total };
}
