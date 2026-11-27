/**
 * Search filters live in the URL query, so results are shareable and work as a
 * plain HTML form with JavaScript off (checkboxes give repeated keys: ?level=a&level=b).
 *
 * Parsing never fails: unknown or invalid values are dropped. Lists come back
 * de-duplicated and in a fixed order, so equal filters always serialize to the
 * same query string (that string is part of the page cache key).
 */
import { z } from 'zod';
import {
  LENGTH_BUCKETS,
  TOTAL_YEARS_FILTERS,
  type LengthBucket,
  type TotalYearsFilter,
} from '../paths.ts';
import {
  COVERAGES,
  FIELDS,
  MINISTRY_STATUSES,
  PROGRAM_LEVELS,
  type Coverage,
  type Field,
  type MinistryStatus,
  type ProgramLevel,
} from '../db/values.ts';

export const PROGRAM_SORTS = ['relevance', 'tuition', 'ranking', 'deadline'] as const;
export type ProgramSort = (typeof PROGRAM_SORTS)[number];

export interface ProgramFilters {
  /** SearchBox text; matched with the full-text index. */
  q: string | null;
  countries: string[];
  levels: ProgramLevel[];
  fields: Field[];
  /** ISO 639-1 teaching languages. */
  languages: string[];
  tuitionMin: number | null;
  tuitionMax: number | null;
  /** Bachelor's length buckets. */
  lengths: LengthBucket[];
  total: TotalYearsFilter | null;
  approvedOnly: boolean;
  hasScholarships: boolean;
  sort: ProgramSort;
  /** "Show more" pages: page n shows the first n × PAGE_SIZE results. */
  page: number;
}

export interface UniversityFilters {
  q: string | null;
  countries: string[];
  statuses: MinistryStatus[];
  hasFoundationYear: boolean;
  hasScholarships: boolean;
  page: number;
}

export interface ScholarshipFilters {
  countries: string[];
  coverages: Coverage[];
  /** Closed scholarships are hidden unless asked for. */
  includeClosed: boolean;
  /** Only scholarships confirmed to pay for the foundation or language year. */
  coversPreYear: boolean;
  /** Only scholarships confirmed open to Turkmen citizens; "not confirmed" is hidden. */
  openToTurkmen: boolean;
  page: number;
}

/** URL query keys. Shared keys (country, scholarships) survive a switch between the two tabs. */
export const PARAM = {
  q: 'q',
  country: 'country',
  level: 'level',
  field: 'field',
  language: 'language',
  tuitionMin: 'min_tuition',
  tuitionMax: 'max_tuition',
  length: 'length',
  total: 'total',
  approved: 'approved',
  scholarships: 'scholarships',
  sort: 'sort',
  page: 'page',
  status: 'status',
  foundation: 'foundation',
  coverage: 'coverage',
  closed: 'closed',
  preYear: 'pre_year',
  turkmen: 'turkmen',
  tab: 'tab',
} as const;

/** At most this many values per list, which keeps every query well under D1's 100 bound parameters. */
const MAX_LIST = 12;
/** "Show more" stops at 10 pages (200 results); past that, filters narrow the list. */
export const MAX_PAGE = 10;
export const MAX_QUERY_LENGTH = 100;
export const MAX_TUITION_USD = 1_000_000;

const countryCode = z
  .string()
  .trim()
  .transform((s) => s.toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{2}$/));
const languageCode = z
  .string()
  .trim()
  .transform((s) => s.toLowerCase())
  .pipe(z.string().regex(/^[a-z]{2}$/));
const usd = z.coerce.number().int().min(0).max(MAX_TUITION_USD);
const page = z.coerce.number().int().min(1).max(MAX_PAGE);
const flag = z.literal('1');
const searchText = z
  .string()
  .transform((s) => s.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH))
  .pipe(z.string().min(1));

/** Valid values of a repeated key. With `order`, sorted by that list (enums); otherwise alphabetically. */
function list<T extends string>(
  params: URLSearchParams,
  key: string,
  schema: z.ZodType<T>,
  order?: readonly T[],
): T[] {
  const values = new Set<T>();
  for (const raw of params.getAll(key)) {
    const parsed = schema.safeParse(raw);
    if (parsed.success) values.add(parsed.data);
  }
  const result = [...values];
  if (order) result.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  else result.sort();
  return result.slice(0, MAX_LIST);
}

function one<T>(params: URLSearchParams, key: string, schema: z.ZodType<T>): T | null {
  const raw = params.get(key);
  if (raw === null || raw === '') return null;
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function parseProgramFilters(params: URLSearchParams): ProgramFilters {
  let tuitionMin = one(params, PARAM.tuitionMin, usd);
  let tuitionMax = one(params, PARAM.tuitionMax, usd);
  if (tuitionMin !== null && tuitionMax !== null && tuitionMin > tuitionMax) {
    [tuitionMin, tuitionMax] = [tuitionMax, tuitionMin];
  }
  return {
    q: one(params, PARAM.q, searchText),
    countries: list(params, PARAM.country, countryCode),
    levels: list(params, PARAM.level, z.enum(PROGRAM_LEVELS), PROGRAM_LEVELS),
    fields: list(params, PARAM.field, z.enum(FIELDS), FIELDS),
    languages: list(params, PARAM.language, languageCode),
    tuitionMin,
    tuitionMax,
    lengths: list(params, PARAM.length, z.enum(LENGTH_BUCKETS), LENGTH_BUCKETS),
    total: one(params, PARAM.total, z.enum(TOTAL_YEARS_FILTERS)),
    approvedOnly: one(params, PARAM.approved, flag) !== null,
    hasScholarships: one(params, PARAM.scholarships, flag) !== null,
    sort: one(params, PARAM.sort, z.enum(PROGRAM_SORTS)) ?? 'relevance',
    page: one(params, PARAM.page, page) ?? 1,
  };
}

export function parseUniversityFilters(params: URLSearchParams): UniversityFilters {
  return {
    q: one(params, PARAM.q, searchText),
    countries: list(params, PARAM.country, countryCode),
    statuses: list(params, PARAM.status, z.enum(MINISTRY_STATUSES), MINISTRY_STATUSES),
    hasFoundationYear: one(params, PARAM.foundation, flag) !== null,
    hasScholarships: one(params, PARAM.scholarships, flag) !== null,
    page: one(params, PARAM.page, page) ?? 1,
  };
}

export function parseScholarshipFilters(params: URLSearchParams): ScholarshipFilters {
  return {
    countries: list(params, PARAM.country, countryCode),
    coverages: list(params, PARAM.coverage, z.enum(COVERAGES), COVERAGES),
    includeClosed: one(params, PARAM.closed, flag) !== null,
    coversPreYear: one(params, PARAM.preYear, flag) !== null,
    openToTurkmen: one(params, PARAM.turkmen, flag) !== null,
    page: one(params, PARAM.page, page) ?? 1,
  };
}

/** Canonical query string for program filters. Defaults are left out. */
export function serializeProgramFilters(filters: ProgramFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set(PARAM.q, filters.q);
  for (const v of filters.countries) params.append(PARAM.country, v);
  for (const v of filters.levels) params.append(PARAM.level, v);
  for (const v of filters.fields) params.append(PARAM.field, v);
  for (const v of filters.languages) params.append(PARAM.language, v);
  if (filters.tuitionMin !== null) params.set(PARAM.tuitionMin, String(filters.tuitionMin));
  if (filters.tuitionMax !== null) params.set(PARAM.tuitionMax, String(filters.tuitionMax));
  for (const v of filters.lengths) params.append(PARAM.length, v);
  if (filters.total) params.set(PARAM.total, filters.total);
  if (filters.approvedOnly) params.set(PARAM.approved, '1');
  if (filters.hasScholarships) params.set(PARAM.scholarships, '1');
  if (filters.sort !== 'relevance') params.set(PARAM.sort, filters.sort);
  if (filters.page !== 1) params.set(PARAM.page, String(filters.page));
  return params;
}

export function serializeUniversityFilters(filters: UniversityFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set(PARAM.q, filters.q);
  for (const v of filters.countries) params.append(PARAM.country, v);
  for (const v of filters.statuses) params.append(PARAM.status, v);
  if (filters.hasFoundationYear) params.set(PARAM.foundation, '1');
  if (filters.hasScholarships) params.set(PARAM.scholarships, '1');
  if (filters.page !== 1) params.set(PARAM.page, String(filters.page));
  return params;
}

export function serializeScholarshipFilters(filters: ScholarshipFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const v of filters.countries) params.append(PARAM.country, v);
  for (const v of filters.coverages) params.append(PARAM.coverage, v);
  if (filters.includeClosed) params.set(PARAM.closed, '1');
  if (filters.coversPreYear) params.set(PARAM.preYear, '1');
  if (filters.openToTurkmen) params.set(PARAM.turkmen, '1');
  if (filters.page !== 1) params.set(PARAM.page, String(filters.page));
  return params;
}

/** How many filters are set, for the "Filters (n)" button. Search text, sort and page don't count. */
export function countProgramFilters(f: ProgramFilters): number {
  return (
    f.countries.length +
    f.levels.length +
    f.fields.length +
    f.languages.length +
    (f.tuitionMin !== null ? 1 : 0) +
    (f.tuitionMax !== null ? 1 : 0) +
    f.lengths.length +
    (f.total ? 1 : 0) +
    (f.approvedOnly ? 1 : 0) +
    (f.hasScholarships ? 1 : 0)
  );
}

export function countUniversityFilters(f: UniversityFilters): number {
  return (
    f.countries.length +
    f.statuses.length +
    (f.hasFoundationYear ? 1 : 0) +
    (f.hasScholarships ? 1 : 0)
  );
}

export function countScholarshipFilters(f: ScholarshipFilters): number {
  return (
    f.countries.length +
    f.coverages.length +
    (f.includeClosed ? 1 : 0) +
    (f.coversPreYear ? 1 : 0) +
    (f.openToTurkmen ? 1 : 0)
  );
}

// ---------------------------------------------------------------------------
// Compare: up to 3 paths to a bachelor's degree
// ---------------------------------------------------------------------------

export const MAX_COMPARE = 3;

/**
 * One column of Compare: a bachelor's program, reached directly or through a
 * pre-year. `preYearId` null means "direct entry, or the university's shortest
 * pre-year when it requires one". In the URL: `101` or `203-201` (pre-year, then bachelor's).
 */
export interface CompareItem {
  bachelorId: number;
  preYearId: number | null;
}

const ID = /^[1-9]\d{0,9}$/;

/** `?ids=101,203-201`: valid, de-duplicated items, at most three, in the given order. */
export function parseCompareIds(params: URLSearchParams): CompareItem[] {
  const items: CompareItem[] = [];
  const seen = new Set<string>();
  const raw = params.getAll('ids').flatMap((v) => v.split(','));
  for (const part of raw) {
    const [first, second, ...rest] = part.trim().split('-');
    if (rest.length > 0 || !first || !ID.test(first)) continue;
    if (second !== undefined && !ID.test(second)) continue;
    const item: CompareItem =
      second === undefined
        ? { bachelorId: Number(first), preYearId: null }
        : { bachelorId: Number(second), preYearId: Number(first) };
    const key = compareKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
    if (items.length === MAX_COMPARE) break;
  }
  return items;
}

export function compareKey(item: CompareItem): string {
  return item.preYearId === null ? String(item.bachelorId) : `${item.preYearId}-${item.bachelorId}`;
}

export function serializeCompareIds(items: readonly CompareItem[]): URLSearchParams {
  const params = new URLSearchParams();
  if (items.length > 0) params.set('ids', items.map(compareKey).join(','));
  return params;
}
