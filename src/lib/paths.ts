/**
 * Study paths: a bachelor's alone (direct entry) or a pre-year (foundation or
 * language) followed by a bachelor's. Clavis states the total years as a plain fact.
 * The SQL in db/queries.ts uses the same rules; tests check that they agree.
 */
import {
  PRE_YEAR_LEVELS,
  type PreYearLevel,
  type ProgramLevel,
  type TriState,
} from './db/values.ts';

export function isPreYear(level: ProgramLevel): level is PreYearLevel {
  return (PRE_YEAR_LEVELS as readonly ProgramLevel[]).includes(level);
}

/**
 * Total years of a path: pre-year (if any) plus the bachelor's.
 * Rounded to two decimals so 0.5 + 3.5 never shows as 3.9999.
 */
export function totalYears(preYearYears: number | null, bachelorYears: number): number {
  return Math.round(((preYearYears ?? 0) + bachelorYears) * 100) / 100;
}

export type PathwayError = 'from_not_pre_year' | 'to_not_bachelor';

/**
 * Pathway rules: `from` must be a foundation or language program, `to` must be a bachelor's.
 * The database enforces the same rules with triggers (migrations/0001_pathway_rules.sql).
 */
export function pathwayErrors(
  from: { level: ProgramLevel },
  to: { level: ProgramLevel },
): PathwayError[] {
  const errors: PathwayError[] = [];
  if (!isPreYear(from.level)) errors.push('from_not_pre_year');
  if (to.level !== 'bachelor') errors.push('to_not_bachelor');
  return errors;
}

/** Can a Turkmen school-leaver start this bachelor's directly? The inverse of pre_year_required. */
export type DirectEntry = TriState;

export function directEntry(preYearRequired: TriState): DirectEntry {
  if (preYearRequired === 'yes') return 'no';
  if (preYearRequired === 'no') return 'yes';
  return 'unknown';
}

/** "Bachelor's length" filter buckets: 3 = under 4 years (3, 3.5), 4 = 4 to under 5, 5+ = 5 or more. */
export const LENGTH_BUCKETS = ['3', '4', '5+'] as const;
export type LengthBucket = (typeof LENGTH_BUCKETS)[number];

export function lengthBucket(years: number): LengthBucket {
  if (years < 4) return '3';
  if (years < 5) return '4';
  return '5+';
}

/** Lower and upper bound (upper exclusive, null = none) of each bucket, shared with the SQL. */
export const LENGTH_BUCKET_RANGES: Record<LengthBucket, readonly [number | null, number | null]> = {
  '3': [null, 4],
  '4': [4, 5],
  '5+': [5, null],
};

/** The "Total years with pre-year" filter. */
export const TOTAL_YEARS_FILTERS = ['4-or-less', 'needs-pre-year', 'direct-entry'] as const;
export type TotalYearsFilter = (typeof TOTAL_YEARS_FILTERS)[number];

/** Paths of 4 years or less match "4 or less". */
export const SHORT_PATH_MAX_YEARS = 4;
