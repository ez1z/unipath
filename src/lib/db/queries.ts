/**
 * Read queries for public pages. Every query filters on `published` and uses an
 * index (tests/unit/db/query-plans.test.ts checks the plans). Total years of a
 * path are computed here from the two programs' durations, never stored.
 */
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { alias, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Lang } from '../../i18n/config.ts';
import { daysBetween, isScholarshipOpen } from '../dates.ts';
import {
  directEntry,
  isPreYear,
  LENGTH_BUCKET_RANGES,
  SHORT_PATH_MAX_YEARS,
  totalYears,
  type DirectEntry,
  type LengthBucket,
} from '../paths.ts';
import type { ProgramFilters, UniversityFilters } from '../search/filters.ts';
import type { Db } from './client.ts';
import { toFtsQuery } from './search-index.ts';
import {
  pathwayColleges,
  pathways,
  programs,
  scholarshipPrograms,
  scholarships,
  scholarshipUniversities,
  translations,
  universities,
  type ProgramRequirements,
} from './schema.ts';
import type {
  Cover,
  Coverage,
  EntityType,
  Field,
  MinistryStatus,
  ProgramLevel,
  ProviderType,
  TriState,
} from './values.ts';

export const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Text in the page language, or English with `fallback: true` ("Not translated yet"). */
export interface LocalText {
  text: string;
  fallback: boolean;
}

export interface ProviderSummary {
  type: ProviderType;
  id: number;
  slug: string;
  name: LocalText;
  city: string;
  countryCode: string;
  countryName: LocalText;
  website: string | null;
  /** Null for pathway colleges, which the Ministry doesn't rank. */
  ministryStatus: MinistryStatus | null;
  /** Position used by the ranking sort: QS, else THE, else ARWU, else Moscow. */
  ranking: number | null;
}

export interface ProgramSummary {
  id: number;
  slug: string;
  level: ProgramLevel;
  name: LocalText;
  field: Field | null;
  languageOfStudy: string;
  durationYears: number;
  tuitionPerYearUsd: number | null;
  applicationDeadline: string | null;
  intakes: number[];
  /** Bachelor's only; null for pre-year programs. */
  preYearRequired: TriState | null;
  directEntry: DirectEntry | null;
  lastChecked: string;
  sourceUrl: string | null;
  provider: ProviderSummary;
}

export interface ProgramCard extends ProgramSummary {
  /** Shortest path to a bachelor's degree through this program; null if none is known. */
  shortestTotalYears: number | null;
}

/** Page n holds the first n × pageSize results ("Show more"). */
export interface SearchPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface UniversityCard {
  id: number;
  slug: string;
  name: LocalText;
  city: string;
  countryCode: string;
  countryName: LocalText;
  ministryStatus: MinistryStatus;
  ministryBasis: string | null;
  rankings: { qs: number | null; the: number | null; arwu: number | null; moscow: number | null };
  ranking: number | null;
  logoKey: string | null;
  lastChecked: string;
  sourceUrl: string | null;
}

export type PathOption =
  | {
      kind: 'direct';
      /** 'yes' = direct entry confirmed, 'unknown' = not confirmed. */
      directEntry: 'yes' | 'unknown';
      bachelor: ProgramSummary;
      totalYears: number;
    }
  | {
      kind: 'pathway';
      pathwayId: number;
      entryGuaranteed: boolean;
      preYear: ProgramSummary;
      bachelor: ProgramSummary;
      totalYears: number;
    };

export interface ScholarshipSummary {
  id: number;
  slug: string;
  name: LocalText;
  provider: string;
  countryCode: string;
  coverage: Coverage;
  coversPreYear: TriState;
  deadline: string | null;
  rolling: boolean;
  open: boolean;
  /** Days until the deadline; null when there is no fixed deadline. Negative once closed. */
  daysLeft: number | null;
  openToTurkmen: TriState;
  /** How it applies to the program: linked to it directly, or valid at its whole university. */
  via: 'program' | 'university';
}

export interface ProgramPage {
  program: ProgramSummary & { requirements: ProgramRequirements };
  /** Ways to reach a bachelor's through this program, shortest first. */
  paths: PathOption[];
  /** Open scholarships first, then by deadline. */
  scholarships: ScholarshipSummary[];
}

export interface ScholarshipDetail {
  id: number;
  slug: string;
  name: LocalText;
  provider: string;
  countryCode: string;
  countryName: LocalText;
  coverage: Coverage;
  covers: Cover[];
  coversPreYear: TriState;
  amountText: LocalText | null;
  deadline: string | null;
  rolling: boolean;
  open: boolean;
  daysLeft: number | null;
  openToTurkmen: TriState;
  eligibility: string[];
  eligibilityFallback: boolean;
  howToApply: LocalText | null;
  lastChecked: string;
  sourceUrl: string | null;
}

export interface ScholarshipPage {
  scholarship: ScholarshipDetail;
  /** Universities where it is valid for every bachelor's program. */
  universities: ProviderSummary[];
  /** "Programs you can use it at". */
  programs: (ProgramSummary & { via: 'program' | 'university' })[];
}

// ---------------------------------------------------------------------------
// SQL building blocks (also used by catalog.ts)
// ---------------------------------------------------------------------------

export function all(...conds: (SQL | undefined)[]): SQL {
  return and(...conds) ?? sql`1`;
}

export function any(...conds: (SQL | undefined)[]): SQL {
  return or(...conds) ?? sql`0`;
}

export function pick<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Pick<T, K> {
  return Object.fromEntries(keys.map((key) => [key, source[key]])) as Pick<T, K>;
}

export const PROGRAM_KEYS = [
  'id',
  'slug',
  'level',
  'name',
  'field',
  'languageOfStudy',
  'durationYears',
  'tuitionPerYearUsd',
  'applicationDeadline',
  'intakes',
  'preYearRequired',
  'lastChecked',
  'sourceUrl',
] as const;
export const UNIVERSITY_KEYS = [
  'id',
  'slug',
  'name',
  'city',
  'countryCode',
  'website',
  'ministryStatus',
  'rankingQs',
  'rankingThe',
  'rankingArwu',
  'rankingMoscow',
] as const;
export const COLLEGE_KEYS = ['id', 'slug', 'name', 'city', 'countryCode', 'website'] as const;

export type ProgramRow = Pick<typeof programs.$inferSelect, (typeof PROGRAM_KEYS)[number]>;
export type UniversityRow = Pick<
  typeof universities.$inferSelect,
  (typeof UNIVERSITY_KEYS)[number]
>;
export type CollegeRow = Pick<typeof pathwayColleges.$inferSelect, (typeof COLLEGE_KEYS)[number]>;

// Aliases for the "other" program of a pathway and its provider.
export const pw = alias(pathways, 'pw');
export const pre = alias(programs, 'pre');
export const preU = alias(universities, 'pre_u');
export const preC = alias(pathwayColleges, 'pre_c');
export const bach = alias(programs, 'bach');
export const bachU = alias(universities, 'bach_u');
export const bachC = alias(pathwayColleges, 'bach_c');
export const sch = alias(scholarships, 'sch');
export const sp = alias(scholarshipPrograms, 'sp');
export const su = alias(scholarshipUniversities, 'su');

/** A program is visible when it and its provider (university or college) are published. */
export const programVisible = (
  program: { published: AnySQLiteColumn },
  uni: { published: AnySQLiteColumn },
  college: { published: AnySQLiteColumn },
) => all(eq(program.published, true), sql`coalesce(${uni.published}, ${college.published}) = 1`);

export const mainVisible = programVisible(programs, universities, pathwayColleges);
export const preVisible = programVisible(pre, preU, preC);
export const bachVisible = programVisible(bach, bachU, bachC);

/** QS, else THE, else ARWU, else Moscow. Matches rankingPosition(). */
function rankingSql(u: {
  rankingQs: AnySQLiteColumn;
  rankingThe: AnySQLiteColumn;
  rankingArwu: AnySQLiteColumn;
  rankingMoscow: AnySQLiteColumn;
}): SQL<number | null> {
  return sql<
    number | null
  >`coalesce(${u.rankingQs}, ${u.rankingThe}, ${u.rankingArwu}, ${u.rankingMoscow})`;
}

export function rankingPosition(u: {
  rankingQs: number | null;
  rankingThe: number | null;
  rankingArwu: number | null;
  rankingMoscow: number | null;
}): number | null {
  return u.rankingQs ?? u.rankingThe ?? u.rankingArwu ?? u.rankingMoscow ?? null;
}

export function openScholarship(today: string): SQL {
  return all(
    eq(sch.published, true),
    any(eq(sch.rolling, true), isNull(sch.deadline), gte(sch.deadline, today)),
  );
}

function lengthCondition(
  years: AnySQLiteColumn,
  buckets: readonly LengthBucket[],
): SQL | undefined {
  if (buckets.length === 0) return undefined;
  return any(
    ...buckets.map((bucket) => {
      const [min, max] = LENGTH_BUCKET_RANGES[bucket];
      return all(
        min === null ? undefined : gte(years, min),
        max === null ? undefined : lt(years, max),
      );
    }),
  );
}

/** Visible pre-year programs leading into `bachelorId`. */
function pathwaysInto(db: Db, bachelorId: AnySQLiteColumn, ...extra: (SQL | undefined)[]) {
  return db
    .select({ one: sql`1` })
    .from(pw)
    .innerJoin(pre, eq(pre.id, pw.fromProgramId))
    .leftJoin(preU, eq(preU.id, pre.universityId))
    .leftJoin(preC, eq(preC.id, pre.collegeId))
    .where(all(eq(pw.toProgramId, bachelorId), preVisible, ...extra));
}

/** Visible bachelor's programs that `preYearId` leads into. */
function pathwaysOutOf(db: Db, preYearId: AnySQLiteColumn, ...extra: (SQL | undefined)[]) {
  return db
    .select({ one: sql`1` })
    .from(pw)
    .innerJoin(bach, eq(bach.id, pw.toProgramId))
    .leftJoin(bachU, eq(bachU.id, bach.universityId))
    .leftJoin(bachC, eq(bachC.id, bach.collegeId))
    .where(all(eq(pw.fromProgramId, preYearId), bachVisible, ...extra));
}

/**
 * Bachelor's length and total-years filters. A bachelor's matches on its own
 * length and pre-year rule; a pre-year program matches when one bachelor's it
 * leads to satisfies every path filter at once.
 */
function pathCondition(db: Db, f: ProgramFilters): SQL | undefined {
  if (f.lengths.length === 0 && f.total === null) return undefined;
  const short = SHORT_PATH_MAX_YEARS;

  let bachelorTotal: SQL | undefined;
  if (f.total === 'needs-pre-year') bachelorTotal = eq(programs.preYearRequired, 'yes');
  else if (f.total === 'direct-entry') bachelorTotal = eq(programs.preYearRequired, 'no');
  else if (f.total === '4-or-less') {
    bachelorTotal = any(
      all(ne(programs.preYearRequired, 'yes'), lte(programs.durationYears, short)),
      exists(
        pathwaysInto(
          db,
          programs.id,
          lte(sql`${pre.durationYears} + ${programs.durationYears}`, short),
        ),
      ),
    );
  }
  const bachelorSide = all(lengthCondition(programs.durationYears, f.lengths), bachelorTotal);

  const preYearSide =
    f.total === 'direct-entry'
      ? sql`0`
      : exists(
          pathwaysOutOf(
            db,
            programs.id,
            lengthCondition(bach.durationYears, f.lengths),
            f.total === 'needs-pre-year' ? eq(bach.preYearRequired, 'yes') : undefined,
            f.total === '4-or-less'
              ? lte(sql`${programs.durationYears} + ${bach.durationYears}`, short)
              : undefined,
          ),
        );

  return any(
    all(eq(programs.level, 'bachelor'), bachelorSide),
    all(ne(programs.level, 'bachelor'), preYearSide),
  );
}

/**
 * Ministry-approved only: the program's university is approved. A college's
 * pre-year program counts when it leads to a bachelor's at an approved university.
 */
function approvedCondition(db: Db): SQL {
  return any(
    eq(universities.ministryStatus, 'approved'),
    all(
      isNotNull(programs.collegeId),
      exists(pathwaysOutOf(db, programs.id, eq(bachU.ministryStatus, 'approved'))),
    ),
  );
}

/**
 * Has scholarships: an open scholarship is linked to the program, or (for a
 * bachelor's) valid at its whole university.
 */
function scholarshipCondition(db: Db, today: string): SQL {
  return any(
    exists(
      db
        .select({ one: sql`1` })
        .from(sp)
        .innerJoin(sch, eq(sch.id, sp.scholarshipId))
        .where(all(eq(sp.programId, programs.id), openScholarship(today))),
    ),
    all(
      eq(programs.level, 'bachelor'),
      exists(
        db
          .select({ one: sql`1` })
          .from(su)
          .innerJoin(sch, eq(sch.id, su.scholarshipId))
          .where(all(eq(su.universityId, programs.universityId), openScholarship(today))),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

export type TextRequest = Partial<Record<EntityType, readonly (string | number)[]>>;

export interface Texts {
  /** Translated text, else English (translation or base column) marked as fallback. */
  get(type: EntityType, id: string | number, field: string, base: string | null): LocalText | null;
  /** Like get() for a name, which always exists. */
  name(type: EntityType, id: string | number, base: string): LocalText;
}

/** Translations for some entities in the page language and English. Null if nothing is asked for. */
export function translationsQuery(db: Db, lang: Lang, wanted: TextRequest, fields: string[]) {
  const groups = Object.entries(wanted)
    .filter(([, ids]) => ids.length > 0)
    .map(([type, ids]) =>
      all(
        eq(translations.entityType, type as EntityType),
        // One bound parameter for any number of ids.
        sql`${translations.entityId} in (select value from json_each(${JSON.stringify([...new Set(ids.map(String))])}))`,
      ),
    );
  if (groups.length === 0) return null;
  const langs: Lang[] = lang === 'en' ? ['en'] : [lang, 'en'];
  return db
    .select()
    .from(translations)
    .where(
      all(any(...groups), inArray(translations.lang, langs), inArray(translations.field, fields)),
    );
}

export async function loadTexts(
  db: Db,
  lang: Lang,
  wanted: TextRequest,
  fields: string[],
): Promise<Texts> {
  const query = translationsQuery(db, lang, wanted, fields);
  const rows = query ? await query : [];

  const map = new Map<string, string>();
  for (const row of rows)
    map.set(`${row.entityType}:${row.entityId}:${row.field}:${row.lang}`, row.text);

  const get: Texts['get'] = (type, id, field, base) => {
    const english = map.get(`${type}:${id}:${field}:en`) ?? base;
    if (lang === 'en') return english === null ? null : { text: english, fallback: false };
    const own = map.get(`${type}:${id}:${field}:${lang}`);
    if (own !== undefined) return { text: own, fallback: false };
    return english === null ? null : { text: english, fallback: true };
  };
  return {
    get,
    name: (type, id, base) => get(type, id, 'name', base) ?? { text: base, fallback: false },
  };
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

export function toProvider(
  uni: UniversityRow | null,
  college: CollegeRow | null,
  texts: Texts,
): ProviderSummary {
  if (uni) {
    return {
      type: 'university',
      id: uni.id,
      slug: uni.slug,
      name: texts.name('university', uni.id, uni.name),
      city: uni.city,
      countryCode: uni.countryCode,
      countryName: texts.name('country', uni.countryCode, uni.countryCode),
      website: uni.website,
      ministryStatus: uni.ministryStatus,
      ranking: rankingPosition(uni),
    };
  }
  if (college) {
    return {
      type: 'college',
      id: college.id,
      slug: college.slug,
      name: texts.name('college', college.id, college.name),
      city: college.city,
      countryCode: college.countryCode,
      countryName: texts.name('country', college.countryCode, college.countryCode),
      website: college.website,
      ministryStatus: null,
      ranking: null,
    };
  }
  // The visibility condition guarantees a provider; reaching here means a broken row.
  throw new Error('Program without a provider');
}

export function toSummary(
  row: ProgramRow,
  uni: UniversityRow | null,
  college: CollegeRow | null,
  texts: Texts,
): ProgramSummary {
  return {
    id: row.id,
    slug: row.slug,
    level: row.level,
    name: texts.name('program', row.id, row.name),
    field: row.field,
    languageOfStudy: row.languageOfStudy,
    durationYears: row.durationYears,
    tuitionPerYearUsd: row.tuitionPerYearUsd,
    applicationDeadline: row.applicationDeadline,
    intakes: row.intakes,
    preYearRequired: row.preYearRequired,
    directEntry: row.preYearRequired === null ? null : directEntry(row.preYearRequired),
    lastChecked: row.lastChecked,
    sourceUrl: row.sourceUrl,
    provider: toProvider(uni, college, texts),
  };
}

/** Ids to translate for a set of program rows. */
export function textRequest(
  rows: { program: { id: number }; university: UniversityRow | null; college: CollegeRow | null }[],
): TextRequest {
  return {
    program: rows.map((r) => r.program.id),
    university: rows.flatMap((r) => (r.university ? [r.university.id] : [])),
    college: rows.flatMap((r) => (r.college ? [r.college.id] : [])),
    country: rows.flatMap((r) => {
      const code = r.university?.countryCode ?? r.college?.countryCode;
      return code ? [code] : [];
    }),
  };
}

export function mergeRequests(...requests: TextRequest[]): TextRequest {
  const merged: Partial<Record<EntityType, (string | number)[]>> = {};
  for (const request of requests) {
    for (const [type, ids] of Object.entries(request) as [EntityType, (string | number)[]][]) {
      (merged[type] ??= []).push(...ids);
    }
  }
  return merged;
}

/** Shortest path through a program, from the shortest linked program on the other side. */
export function shortestTotalYears(
  program: { level: ProgramLevel; durationYears: number; preYearRequired: TriState | null },
  shortestPreYear: number | null,
  shortestBachelor: number | null,
): number | null {
  if (isPreYear(program.level)) {
    return shortestBachelor === null ? null : totalYears(program.durationYears, shortestBachelor);
  }
  const options: number[] = [];
  if (program.preYearRequired !== 'yes') options.push(totalYears(null, program.durationYears));
  if (shortestPreYear !== null) options.push(totalYears(shortestPreYear, program.durationYears));
  return options.length === 0 ? null : Math.min(...options);
}

// ---------------------------------------------------------------------------
// Search programs
// ---------------------------------------------------------------------------

export interface SearchOptions {
  lang: Lang;
  /** `YYYY-MM-DD`, normally todayIn(). Closed scholarships and past deadlines depend on it. */
  today: string;
  pageSize?: number;
}

export interface ProgramSearchOptions extends SearchOptions {
  /** One more condition on `programs` (Matches for you: the English score). */
  where?: SQL | undefined;
}

/** Matches the full-text index; rowid is the record's id. */
function textMatch(
  table: 'program_search' | 'university_search',
  id: AnySQLiteColumn,
  fts: string,
) {
  return sql`${id} in (select rowid from ${sql.identifier(table)} where ${sql.identifier(table)} match ${fts})`;
}

/** bm25 rank of a matched row (lower is better). */
function textRank(table: 'program_search' | 'university_search', id: AnySQLiteColumn, fts: string) {
  return sql`(select rank from ${sql.identifier(table)} where ${sql.identifier(table)} match ${fts} and rowid = ${id})`;
}

/** The program search as a query builder (not yet run), so tests can read its plan. */
export function programSearchQuery(
  db: Db,
  f: ProgramFilters,
  today: string,
  pageSize = PAGE_SIZE,
  extra?: SQL,
) {
  const fts = toFtsQuery(f.q);
  const country = sql`coalesce(${universities.countryCode}, ${pathwayColleges.countryCode})`;
  const shortestPre = db
    .select({ years: sql`min(${pre.durationYears})` })
    .from(pw)
    .innerJoin(pre, eq(pre.id, pw.fromProgramId))
    .leftJoin(preU, eq(preU.id, pre.universityId))
    .leftJoin(preC, eq(preC.id, pre.collegeId))
    .where(all(eq(pw.toProgramId, programs.id), preVisible));
  const shortestBachelor = db
    .select({ years: sql`min(${bach.durationYears})` })
    .from(pw)
    .innerJoin(bach, eq(bach.id, pw.toProgramId))
    .leftJoin(bachU, eq(bachU.id, bach.universityId))
    .leftJoin(bachC, eq(bachC.id, bach.collegeId))
    .where(all(eq(pw.fromProgramId, programs.id), bachVisible));

  const where = all(
    eq(programs.published, true),
    fts ? textMatch('program_search', programs.id, fts) : undefined,
    f.levels.length > 0 ? inArray(programs.level, f.levels) : undefined,
    mainVisible,
    f.countries.length > 0 ? inArray(country, f.countries) : undefined,
    f.fields.length > 0 ? inArray(programs.field, f.fields) : undefined,
    f.languages.length > 0 ? inArray(programs.languageOfStudy, f.languages) : undefined,
    // A cost filter only matches programs whose cost is confirmed.
    f.tuitionMin !== null ? gte(programs.tuitionPerYearUsd, f.tuitionMin) : undefined,
    f.tuitionMax !== null ? lte(programs.tuitionPerYearUsd, f.tuitionMax) : undefined,
    pathCondition(db, f),
    f.approvedOnly ? approvedCondition(db) : undefined,
    f.hasScholarships ? scholarshipCondition(db, today) : undefined,
    extra,
  );

  const ranking = rankingSql(universities);
  const deadline = programs.applicationDeadline;
  const order: SQL[] = {
    // Best text match first (with a query), then Ministry-approved, then the most recently checked.
    relevance: [
      ...(fts ? [asc(textRank('program_search', programs.id, fts))] : []),
      desc(sql`coalesce(${universities.ministryStatus} = 'approved', 0)`),
      desc(programs.lastChecked),
    ],
    tuition: [asc(sql`${programs.tuitionPerYearUsd} is null`), asc(programs.tuitionPerYearUsd)],
    ranking: [asc(sql`${ranking} is null`), asc(ranking)],
    // Upcoming deadlines first, soonest first; past or unknown deadlines last.
    deadline: [asc(sql`(${deadline} is null or ${deadline} < ${today})`), asc(deadline)],
  }[f.sort];

  return db
    .select({
      program: pick(programs, PROGRAM_KEYS),
      university: pick(universities, UNIVERSITY_KEYS),
      college: pick(pathwayColleges, COLLEGE_KEYS),
      shortestPre: sql<number | null>`(${shortestPre})`,
      shortestBachelor: sql<number | null>`(${shortestBachelor})`,
      total: sql<number>`count(*) over ()`,
    })
    .from(programs)
    .leftJoin(universities, eq(universities.id, programs.universityId))
    .leftJoin(pathwayColleges, eq(pathwayColleges.id, programs.collegeId))
    .where(where)
    .orderBy(...order, asc(programs.id))
    .limit(pageSize * f.page);
}

export async function searchPrograms(
  db: Db,
  f: ProgramFilters,
  { lang, today, pageSize = PAGE_SIZE, where }: ProgramSearchOptions,
): Promise<SearchPage<ProgramCard>> {
  const rows = await programSearchQuery(db, f, today, pageSize, where);
  const texts = await loadTexts(db, lang, textRequest(rows), ['name']);
  return {
    items: rows.map((row) => ({
      ...toSummary(row.program, row.university, row.college, texts),
      shortestTotalYears: shortestTotalYears(row.program, row.shortestPre, row.shortestBachelor),
    })),
    total: rows[0]?.total ?? 0,
    page: f.page,
    pageSize,
    hasMore: (rows[0]?.total ?? 0) > rows.length,
  };
}

// ---------------------------------------------------------------------------
// Search universities
// ---------------------------------------------------------------------------

export function universitySearchQuery(
  db: Db,
  f: UniversityFilters,
  today: string,
  pageSize = PAGE_SIZE,
) {
  // Its own foundation year, or one at a college that leads to one of its bachelor's programs.
  const hasFoundation = any(
    exists(
      db
        .select({ one: sql`1` })
        .from(pre)
        .where(
          all(
            eq(pre.level, 'foundation'),
            eq(pre.universityId, universities.id),
            eq(pre.published, true),
          ),
        ),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(bach)
        .innerJoin(pw, eq(pw.toProgramId, bach.id))
        .innerJoin(pre, eq(pre.id, pw.fromProgramId))
        .leftJoin(preU, eq(preU.id, pre.universityId))
        .leftJoin(preC, eq(preC.id, pre.collegeId))
        .where(
          all(
            eq(bach.universityId, universities.id),
            eq(bach.published, true),
            eq(pre.level, 'foundation'),
            preVisible,
          ),
        ),
    ),
  );
  const hasScholarship = any(
    exists(
      db
        .select({ one: sql`1` })
        .from(su)
        .innerJoin(sch, eq(sch.id, su.scholarshipId))
        .where(all(eq(su.universityId, universities.id), openScholarship(today))),
    ),
    exists(
      db
        .select({ one: sql`1` })
        .from(bach)
        .innerJoin(sp, eq(sp.programId, bach.id))
        .innerJoin(sch, eq(sch.id, sp.scholarshipId))
        .where(
          all(
            eq(bach.universityId, universities.id),
            eq(bach.published, true),
            openScholarship(today),
          ),
        ),
    ),
  );

  const fts = toFtsQuery(f.q);
  const ranking = rankingSql(universities);
  return db
    .select({
      university: pick(universities, [
        ...UNIVERSITY_KEYS,
        'ministryBasis',
        'logoKey',
        'lastChecked',
        'sourceUrl',
      ] as const),
      total: sql<number>`count(*) over ()`,
    })
    .from(universities)
    .where(
      all(
        eq(universities.published, true),
        fts ? textMatch('university_search', universities.id, fts) : undefined,
        f.statuses.length > 0 ? inArray(universities.ministryStatus, f.statuses) : undefined,
        f.countries.length > 0 ? inArray(universities.countryCode, f.countries) : undefined,
        f.hasFoundationYear ? hasFoundation : undefined,
        f.hasScholarships ? hasScholarship : undefined,
      ),
    )
    .orderBy(
      ...(fts ? [asc(textRank('university_search', universities.id, fts))] : []),
      desc(sql`${universities.ministryStatus} = 'approved'`),
      asc(sql`${ranking} is null`),
      asc(ranking),
      asc(universities.name),
      asc(universities.id),
    )
    .limit(pageSize * f.page);
}

export async function searchUniversities(
  db: Db,
  f: UniversityFilters,
  { lang, today, pageSize = PAGE_SIZE }: SearchOptions,
): Promise<SearchPage<UniversityCard>> {
  const rows = await universitySearchQuery(db, f, today, pageSize);
  const texts = await loadTexts(
    db,
    lang,
    {
      university: rows.map((r) => r.university.id),
      country: rows.map((r) => r.university.countryCode),
    },
    ['name'],
  );
  return {
    items: rows.map(({ university: u }) => ({
      id: u.id,
      slug: u.slug,
      name: texts.name('university', u.id, u.name),
      city: u.city,
      countryCode: u.countryCode,
      countryName: texts.name('country', u.countryCode, u.countryCode),
      ministryStatus: u.ministryStatus,
      ministryBasis: u.ministryBasis,
      rankings: {
        qs: u.rankingQs,
        the: u.rankingThe,
        arwu: u.rankingArwu,
        moscow: u.rankingMoscow,
      },
      ranking: rankingPosition(u),
      logoKey: u.logoKey,
      lastChecked: u.lastChecked,
      sourceUrl: u.sourceUrl,
    })),
    total: rows[0]?.total ?? 0,
    page: f.page,
    pageSize,
    hasMore: (rows[0]?.total ?? 0) > rows.length,
  };
}

// ---------------------------------------------------------------------------
// Program page: program, its paths with total years, and its scholarships
// ---------------------------------------------------------------------------

export const scholarshipSummaryKeys = [
  'id',
  'slug',
  'name',
  'provider',
  'countryCode',
  'coverage',
  'coversPreYear',
  'deadline',
  'rolling',
  'openToTurkmen',
] as const;

export function getProgramWithPathways(
  db: Db,
  slug: string,
  options: Omit<SearchOptions, 'pageSize'>,
): Promise<ProgramPage | null> {
  return loadProgramPage(db, eq(programs.slug, slug), options);
}

/** The same page by id (Compare). */
export function getProgramPageById(
  db: Db,
  id: number,
  options: Omit<SearchOptions, 'pageSize'>,
): Promise<ProgramPage | null> {
  return loadProgramPage(db, eq(programs.id, id), options);
}

async function loadProgramPage(
  db: Db,
  match: SQL,
  { lang, today }: Omit<SearchOptions, 'pageSize'>,
): Promise<ProgramPage | null> {
  const [row] = await db
    .select({
      program: pick(programs, [...PROGRAM_KEYS, 'requirements', 'universityId'] as const),
      university: pick(universities, UNIVERSITY_KEYS),
      college: pick(pathwayColleges, COLLEGE_KEYS),
    })
    .from(programs)
    .leftJoin(universities, eq(universities.id, programs.universityId))
    .leftJoin(pathwayColleges, eq(pathwayColleges.id, programs.collegeId))
    .where(all(match, mainVisible))
    .limit(1);
  if (!row) return null;
  const { program } = row;
  const bachelor = program.level === 'bachelor';

  // Promise.all, not db.batch: drizzle maps D1 batch rows by column name, which breaks
  // joined selects where two tables share a column name (id, name).
  const [into, outOf, direct, viaUniversity] = await Promise.all([
    db
      .select({
        pathwayId: pw.id,
        entryGuaranteed: pw.entryGuaranteed,
        program: pick(pre, PROGRAM_KEYS),
        university: pick(preU, UNIVERSITY_KEYS),
        college: pick(preC, COLLEGE_KEYS),
      })
      .from(pw)
      .innerJoin(pre, eq(pre.id, pw.fromProgramId))
      .leftJoin(preU, eq(preU.id, pre.universityId))
      .leftJoin(preC, eq(preC.id, pre.collegeId))
      .where(all(eq(pw.toProgramId, program.id), preVisible, bachelor ? undefined : sql`0`))
      .orderBy(asc(pre.durationYears), asc(pre.id)),
    db
      .select({
        pathwayId: pw.id,
        entryGuaranteed: pw.entryGuaranteed,
        program: pick(bach, PROGRAM_KEYS),
        university: pick(bachU, UNIVERSITY_KEYS),
        college: pick(bachC, COLLEGE_KEYS),
      })
      .from(pw)
      .innerJoin(bach, eq(bach.id, pw.toProgramId))
      .leftJoin(bachU, eq(bachU.id, bach.universityId))
      .leftJoin(bachC, eq(bachC.id, bach.collegeId))
      .where(all(eq(pw.fromProgramId, program.id), bachVisible, bachelor ? sql`0` : undefined))
      .orderBy(asc(bach.durationYears), asc(bach.id)),
    db
      .select(pick(scholarships, scholarshipSummaryKeys))
      .from(scholarshipPrograms)
      .innerJoin(scholarships, eq(scholarships.id, scholarshipPrograms.scholarshipId))
      .where(all(eq(scholarshipPrograms.programId, program.id), eq(scholarships.published, true))),
    db
      .select(pick(scholarships, scholarshipSummaryKeys))
      .from(scholarshipUniversities)
      .innerJoin(scholarships, eq(scholarships.id, scholarshipUniversities.scholarshipId))
      .where(
        all(
          eq(scholarshipUniversities.universityId, program.universityId ?? -1),
          eq(scholarships.published, true),
          bachelor ? undefined : sql`0`,
        ),
      ),
  ]);

  const linked = [...into, ...outOf];
  const texts = await loadTexts(
    db,
    lang,
    mergeRequests(textRequest([row]), textRequest(linked), {
      scholarship: [...direct, ...viaUniversity].map((s) => s.id),
    }),
    ['name'],
  );
  const self = toSummary(program, row.university, row.college, texts);

  const paths: PathOption[] = [];
  if (bachelor && self.directEntry !== 'no') {
    paths.push({
      kind: 'direct',
      directEntry: self.directEntry === 'yes' ? 'yes' : 'unknown',
      bachelor: self,
      totalYears: totalYears(null, self.durationYears),
    });
  }
  for (const link of into) {
    const preYear = toSummary(link.program, link.university, link.college, texts);
    paths.push({
      kind: 'pathway',
      pathwayId: link.pathwayId,
      entryGuaranteed: link.entryGuaranteed,
      preYear,
      bachelor: self,
      totalYears: totalYears(preYear.durationYears, self.durationYears),
    });
  }
  for (const link of outOf) {
    const target = toSummary(link.program, link.university, link.college, texts);
    paths.push({
      kind: 'pathway',
      pathwayId: link.pathwayId,
      entryGuaranteed: link.entryGuaranteed,
      preYear: self,
      bachelor: target,
      totalYears: totalYears(self.durationYears, target.durationYears),
    });
  }
  paths.sort((a, b) => a.totalYears - b.totalYears);

  const seen = new Set<number>();
  const found: ScholarshipSummary[] = [];
  for (const [via, list] of [
    ['program', direct],
    ['university', viaUniversity],
  ] as const) {
    for (const s of list) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      found.push({
        ...s,
        name: texts.name('scholarship', s.id, s.name),
        open: isScholarshipOpen(s, today),
        daysLeft: s.deadline === null ? null : daysBetween(today, s.deadline),
        via,
      });
    }
  }
  found.sort(
    (a, b) =>
      Number(b.open) - Number(a.open) ||
      (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') ||
      a.id - b.id,
  );

  return {
    program: { ...self, requirements: program.requirements },
    paths,
    scholarships: found,
  };
}

// ---------------------------------------------------------------------------
// Scholarship page: the scholarship and the programs it can be used at
// ---------------------------------------------------------------------------

export async function getScholarshipWithPrograms(
  db: Db,
  slug: string,
  { lang, today }: Omit<SearchOptions, 'pageSize'>,
): Promise<ScholarshipPage | null> {
  const [s] = await db
    .select()
    .from(scholarships)
    .where(all(eq(scholarships.slug, slug), eq(scholarships.published, true)))
    .limit(1);
  if (!s) return null;

  const programColumns = {
    program: pick(programs, PROGRAM_KEYS),
    university: pick(universities, UNIVERSITY_KEYS),
    college: pick(pathwayColleges, COLLEGE_KEYS),
  };
  const [unis, direct, viaUniversity] = await Promise.all([
    db
      .select(pick(universities, UNIVERSITY_KEYS))
      .from(scholarshipUniversities)
      .innerJoin(universities, eq(universities.id, scholarshipUniversities.universityId))
      .where(all(eq(scholarshipUniversities.scholarshipId, s.id), eq(universities.published, true)))
      .orderBy(asc(universities.name)),
    db
      .select(programColumns)
      .from(scholarshipPrograms)
      .innerJoin(programs, eq(programs.id, scholarshipPrograms.programId))
      .leftJoin(universities, eq(universities.id, programs.universityId))
      .leftJoin(pathwayColleges, eq(pathwayColleges.id, programs.collegeId))
      .where(all(eq(scholarshipPrograms.scholarshipId, s.id), mainVisible)),
    db
      .select(programColumns)
      .from(scholarshipUniversities)
      .innerJoin(programs, eq(programs.universityId, scholarshipUniversities.universityId))
      .leftJoin(universities, eq(universities.id, programs.universityId))
      .leftJoin(pathwayColleges, eq(pathwayColleges.id, programs.collegeId))
      .where(
        all(
          eq(scholarshipUniversities.scholarshipId, s.id),
          eq(programs.level, 'bachelor'),
          mainVisible,
        ),
      ),
  ]);

  const texts = await loadTexts(
    db,
    lang,
    mergeRequests(textRequest(direct), textRequest(viaUniversity), {
      scholarship: [s.id],
      university: unis.map((u) => u.id),
      country: [s.countryCode, ...unis.map((u) => u.countryCode)],
    }),
    ['name', 'amount_text', 'how_to_apply', 'eligibility'],
  );

  const eligibilityText = texts.get('scholarship', s.id, 'eligibility', null);
  const translatedEligibility = eligibilityText ? parseStringList(eligibilityText.text) : null;

  const seen = new Set<number>();
  const usable: ScholarshipPage['programs'] = [];
  for (const [via, list] of [
    ['program', direct],
    ['university', viaUniversity],
  ] as const) {
    for (const r of list) {
      if (seen.has(r.program.id)) continue;
      seen.add(r.program.id);
      usable.push({ ...toSummary(r.program, r.university, r.college, texts), via });
    }
  }
  usable.sort(
    (a, b) =>
      a.provider.name.text.localeCompare(b.provider.name.text, lang) ||
      a.name.text.localeCompare(b.name.text, lang),
  );

  return {
    scholarship: {
      id: s.id,
      slug: s.slug,
      name: texts.name('scholarship', s.id, s.name),
      provider: s.provider,
      countryCode: s.countryCode,
      countryName: texts.name('country', s.countryCode, s.countryCode),
      coverage: s.coverage,
      covers: s.covers,
      coversPreYear: s.coversPreYear,
      amountText: texts.get('scholarship', s.id, 'amount_text', s.amountText),
      deadline: s.deadline,
      rolling: s.rolling,
      open: isScholarshipOpen(s, today),
      daysLeft: s.deadline === null ? null : daysBetween(today, s.deadline),
      openToTurkmen: s.openToTurkmen,
      eligibility: translatedEligibility && eligibilityText ? translatedEligibility : s.eligibility,
      eligibilityFallback:
        translatedEligibility && eligibilityText ? eligibilityText.fallback : lang !== 'en',
      howToApply: texts.get('scholarship', s.id, 'how_to_apply', s.howToApply),
      lastChecked: s.lastChecked,
      sourceUrl: s.sourceUrl,
    },
    universities: unis.map((u) => toProvider(u, null, texts)),
    programs: usable,
  };
}

/** A JSON array of strings, or null if the text isn't one. */
function parseStringList(text: string): string[] | null {
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) && value.every((v) => typeof v === 'string') ? value : null;
  } catch {
    return null;
  }
}
