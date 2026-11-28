/**
 * Read queries for the M2 pages that queries.ts doesn't cover: university and
 * pathway college pages, scholarship search, Compare, Home lists, the USD→TMT
 * rate and "Report a mistake". Same rules: published records only, indexed
 * reads (tests/unit/db/query-plans.test.ts), total years computed, never stored.
 */
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import type { Lang } from '../../i18n/config.ts';
import { daysBetween, isScholarshipOpen } from '../dates.ts';
import type { UsdTmtRate } from '../format.ts';
import { totalYears } from '../paths.ts';
import { compareKey, type CompareItem, type ScholarshipFilters } from '../search/filters.ts';
import type { Db } from './client.ts';
import {
  all,
  bach,
  bachC,
  bachU,
  bachVisible,
  COLLEGE_KEYS,
  getProgramPageById,
  loadTexts,
  mainVisible,
  mergeRequests,
  PAGE_SIZE,
  pick,
  pre,
  preC,
  preU,
  preVisible,
  PROGRAM_KEYS,
  pw,
  rankingPosition,
  scholarshipSummaryKeys,
  textRequest,
  toProvider,
  toSummary,
  UNIVERSITY_KEYS,
  type LocalText,
  type ProgramSummary,
  type ProviderSummary,
  type ScholarshipSummary,
  type SearchOptions,
  type SearchPage,
  type Texts,
  type UniversityCard,
} from './queries.ts';
import {
  countries,
  mistakeReports,
  pathwayColleges,
  programs,
  scholarshipPrograms,
  scholarships,
  scholarshipUniversities,
  settings,
  universities,
  type ProgramRequirements,
} from './schema.ts';
import type { Cover, UniversityType } from './values.ts';

type PageOptions = Omit<SearchOptions, 'pageSize'>;

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

/** A bachelor's program a pre-year leads to. */
export interface PathTarget {
  pathwayId: number;
  slug: string;
  name: LocalText;
  provider: ProviderSummary;
  durationYears: number;
  totalYears: number;
  entryGuaranteed: boolean;
}

/** A row in a program list (University and College pages). */
export interface ProgramListItem extends ProgramSummary {
  requirements: ProgramRequirements;
  /** Shortest path to a bachelor's through this program; null if none is listed. */
  shortestTotalYears: number | null;
  /** Pre-years only: where it leads, shortest first. */
  leadsTo: PathTarget[];
}

function sortByTotal(targets: PathTarget[]): PathTarget[] {
  return targets.sort(
    (a, b) => a.totalYears - b.totalYears || a.name.text.localeCompare(b.name.text),
  );
}

function scholarshipSummary(
  s: Pick<typeof scholarships.$inferSelect, (typeof scholarshipSummaryKeys)[number]>,
  via: ScholarshipSummary['via'],
  texts: Texts,
  today: string,
): ScholarshipSummary {
  return {
    ...s,
    name: texts.name('scholarship', s.id, s.name),
    open: isScholarshipOpen(s, today),
    daysLeft: s.deadline === null ? null : daysBetween(today, s.deadline),
    via,
  };
}

/** Open first, then nearest deadline (no deadline last), then id. */
function byOpenThenDeadline(a: ScholarshipSummary, b: ScholarshipSummary): number {
  return (
    Number(b.open) - Number(a.open) ||
    (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') ||
    a.id - b.id
  );
}

// ---------------------------------------------------------------------------
// University page
// ---------------------------------------------------------------------------

export interface UniversityPage {
  university: UniversityCard & {
    type: UniversityType | null;
    website: string | null;
    /** R2 key of the header photo (/files/photos/…), or null. */
    photoKey: string | null;
  };
  /** Its bachelor's programs, by name. */
  bachelors: ProgramListItem[];
  /** Its own foundation and language programs, then college pre-years that lead into its bachelor's. */
  preYears: ProgramListItem[];
  /** Open first, then by deadline. */
  scholarships: ScholarshipSummary[];
  summary: {
    /** Range of known bachelor's tuition; null when none is confirmed. */
    tuitionMinUsd: number | null;
    tuitionMaxUsd: number | null;
    /** Soonest application deadline from today on, any level. */
    nextDeadline: string | null;
    /** Lowest IELTS asked for any bachelor's; null when none lists one. */
    ieltsMin: number | null;
    openScholarships: number;
  };
}

const LIST_KEYS = [...PROGRAM_KEYS, 'requirements'] as const;

export async function getUniversityPage(
  db: Db,
  slug: string,
  { lang, today }: PageOptions,
): Promise<UniversityPage | null> {
  const [u] = await db
    .select()
    .from(universities)
    .where(and(eq(universities.slug, slug), eq(universities.published, true)))
    .limit(1);
  if (!u) return null;

  // Promise.all, not db.batch: see getProgramWithPathways.
  const [own, into, outOf, uniWide, linked] = await Promise.all([
    db
      .select(pick(programs, LIST_KEYS))
      .from(programs)
      .where(and(eq(programs.universityId, u.id), eq(programs.published, true))),
    // Visible pre-years (its own or a college's) leading into its bachelor's programs.
    db
      .select({
        pathwayId: pw.id,
        toId: pw.toProgramId,
        entryGuaranteed: pw.entryGuaranteed,
        program: pick(pre, LIST_KEYS),
        university: pick(preU, UNIVERSITY_KEYS),
        college: pick(preC, COLLEGE_KEYS),
      })
      .from(bach)
      .innerJoin(pw, eq(pw.toProgramId, bach.id))
      .innerJoin(pre, eq(pre.id, pw.fromProgramId))
      .leftJoin(preU, eq(preU.id, pre.universityId))
      .leftJoin(preC, eq(preC.id, pre.collegeId))
      .where(all(eq(bach.universityId, u.id), eq(bach.published, true), preVisible)),
    // Visible bachelor's programs its own pre-years lead to (here or elsewhere).
    db
      .select({
        pathwayId: pw.id,
        fromId: pw.fromProgramId,
        entryGuaranteed: pw.entryGuaranteed,
        program: pick(bach, PROGRAM_KEYS),
        university: pick(bachU, UNIVERSITY_KEYS),
        college: pick(bachC, COLLEGE_KEYS),
      })
      .from(pre)
      .innerJoin(pw, eq(pw.fromProgramId, pre.id))
      .innerJoin(bach, eq(bach.id, pw.toProgramId))
      .leftJoin(bachU, eq(bachU.id, bach.universityId))
      .leftJoin(bachC, eq(bachC.id, bach.collegeId))
      .where(all(eq(pre.universityId, u.id), eq(pre.published, true), bachVisible)),
    db
      .select(pick(scholarships, scholarshipSummaryKeys))
      .from(scholarshipUniversities)
      .innerJoin(scholarships, eq(scholarships.id, scholarshipUniversities.scholarshipId))
      .where(and(eq(scholarshipUniversities.universityId, u.id), eq(scholarships.published, true))),
    db
      .selectDistinct(pick(scholarships, scholarshipSummaryKeys))
      .from(programs)
      .innerJoin(scholarshipPrograms, eq(scholarshipPrograms.programId, programs.id))
      .innerJoin(scholarships, eq(scholarships.id, scholarshipPrograms.scholarshipId))
      .where(
        and(
          eq(programs.universityId, u.id),
          eq(programs.published, true),
          eq(scholarships.published, true),
        ),
      ),
  ]);

  const self = { university: pick(u, UNIVERSITY_KEYS), college: null };
  const texts = await loadTexts(
    db,
    lang,
    mergeRequests(
      textRequest(own.map((program) => ({ program, ...self }))),
      textRequest(into),
      textRequest(outOf),
      { scholarship: [...uniWide, ...linked].map((s) => s.id) },
    ),
    ['name'],
  );
  const summaryOf = (row: (typeof own)[number]) => toSummary(row, self.university, null, texts);

  const ownById = new Map(own.map((p) => [p.id, summaryOf(p)]));
  const bachelors: ProgramListItem[] = own
    .filter((p) => p.level === 'bachelor')
    .map((p) => {
      const preDurations = into.filter((r) => r.toId === p.id).map((r) => r.program.durationYears);
      const options: number[] = [];
      if (p.preYearRequired !== 'yes') options.push(totalYears(null, p.durationYears));
      for (const d of preDurations) options.push(totalYears(d, p.durationYears));
      return {
        ...summaryOf(p),
        requirements: p.requirements,
        shortestTotalYears: options.length > 0 ? Math.min(...options) : null,
        leadsTo: [],
      };
    });

  const preYears: ProgramListItem[] = [];
  for (const p of own.filter((row) => row.level !== 'bachelor')) {
    const leadsTo = sortByTotal(
      outOf
        .filter((r) => r.fromId === p.id)
        .map((r) => {
          const target = toSummary(r.program, r.university, r.college, texts);
          return {
            pathwayId: r.pathwayId,
            slug: target.slug,
            name: target.name,
            provider: target.provider,
            durationYears: target.durationYears,
            totalYears: totalYears(p.durationYears, target.durationYears),
            entryGuaranteed: r.entryGuaranteed,
          };
        }),
    );
    preYears.push({
      ...summaryOf(p),
      requirements: p.requirements,
      shortestTotalYears: leadsTo[0]?.totalYears ?? null,
      leadsTo,
    });
  }
  // A college's pre-year, with only the bachelor's programs here that it leads to.
  const fromColleges = new Map<number, ProgramListItem>();
  for (const r of into) {
    if (r.college === null) continue;
    const target = ownById.get(r.toId);
    if (!target) continue;
    const item =
      fromColleges.get(r.program.id) ??
      ({
        ...toSummary(r.program, r.university, r.college, texts),
        requirements: r.program.requirements,
        shortestTotalYears: null,
        leadsTo: [],
      } satisfies ProgramListItem);
    item.leadsTo.push({
      pathwayId: r.pathwayId,
      slug: target.slug,
      name: target.name,
      provider: target.provider,
      durationYears: target.durationYears,
      totalYears: totalYears(r.program.durationYears, target.durationYears),
      entryGuaranteed: r.entryGuaranteed,
    });
    fromColleges.set(r.program.id, item);
  }
  for (const item of fromColleges.values()) {
    sortByTotal(item.leadsTo);
    item.shortestTotalYears = item.leadsTo[0]?.totalYears ?? null;
  }

  const byName = (a: ProgramListItem, b: ProgramListItem) =>
    a.name.text.localeCompare(b.name.text, lang);
  bachelors.sort(byName);
  preYears.sort(byName);
  preYears.push(...[...fromColleges.values()].sort(byName));

  const seen = new Set<number>();
  const found: ScholarshipSummary[] = [];
  for (const [via, list] of [
    ['university', uniWide],
    ['program', linked],
  ] as const) {
    for (const s of list) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      found.push(scholarshipSummary(s, via, texts, today));
    }
  }
  found.sort(byOpenThenDeadline);

  const tuitions = bachelors.flatMap((p) =>
    p.tuitionPerYearUsd === null ? [] : [p.tuitionPerYearUsd],
  );
  const ielts = bachelors.flatMap((p) =>
    p.requirements.ieltsMin === null ? [] : [p.requirements.ieltsMin],
  );
  const deadlines = own
    .map((p) => p.applicationDeadline)
    .filter((d): d is string => d !== null && d >= today)
    .sort();

  return {
    university: {
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
      photoKey: u.photoKey,
      lastChecked: u.lastChecked,
      sourceUrl: u.sourceUrl,
      type: u.type,
      website: u.website,
    },
    bachelors,
    preYears,
    scholarships: found,
    summary: {
      tuitionMinUsd: tuitions.length > 0 ? Math.min(...tuitions) : null,
      tuitionMaxUsd: tuitions.length > 0 ? Math.max(...tuitions) : null,
      nextDeadline: deadlines[0] ?? null,
      ieltsMin: ielts.length > 0 ? Math.min(...ielts) : null,
      openScholarships: found.filter((s) => s.open).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Pathway college page
// ---------------------------------------------------------------------------

export interface CollegePage {
  college: ProviderSummary & { lastChecked: string; sourceUrl: string | null };
  programs: ProgramListItem[];
}

export async function getCollegePage(
  db: Db,
  slug: string,
  { lang }: PageOptions,
): Promise<CollegePage | null> {
  const [c] = await db
    .select()
    .from(pathwayColleges)
    .where(and(eq(pathwayColleges.slug, slug), eq(pathwayColleges.published, true)))
    .limit(1);
  if (!c) return null;

  const [own, outOf] = await Promise.all([
    db
      .select(pick(programs, LIST_KEYS))
      .from(programs)
      .where(and(eq(programs.collegeId, c.id), eq(programs.published, true))),
    db
      .select({
        pathwayId: pw.id,
        fromId: pw.fromProgramId,
        entryGuaranteed: pw.entryGuaranteed,
        program: pick(bach, PROGRAM_KEYS),
        university: pick(bachU, UNIVERSITY_KEYS),
        college: pick(bachC, COLLEGE_KEYS),
      })
      .from(pre)
      .innerJoin(pw, eq(pw.fromProgramId, pre.id))
      .innerJoin(bach, eq(bach.id, pw.toProgramId))
      .leftJoin(bachU, eq(bachU.id, bach.universityId))
      .leftJoin(bachC, eq(bachC.id, bach.collegeId))
      .where(all(eq(pre.collegeId, c.id), eq(pre.published, true), bachVisible)),
  ]);

  const self = { university: null, college: pick(c, COLLEGE_KEYS) };
  const texts = await loadTexts(
    db,
    lang,
    mergeRequests(textRequest(own.map((program) => ({ program, ...self }))), textRequest(outOf)),
    ['name'],
  );

  const items = own.map((p): ProgramListItem => {
    const leadsTo = sortByTotal(
      outOf
        .filter((r) => r.fromId === p.id)
        .map((r) => {
          const target = toSummary(r.program, r.university, r.college, texts);
          return {
            pathwayId: r.pathwayId,
            slug: target.slug,
            name: target.name,
            provider: target.provider,
            durationYears: target.durationYears,
            totalYears: totalYears(p.durationYears, target.durationYears),
            entryGuaranteed: r.entryGuaranteed,
          };
        }),
    );
    return {
      ...toSummary(p, null, self.college, texts),
      requirements: p.requirements,
      shortestTotalYears: leadsTo[0]?.totalYears ?? null,
      leadsTo,
    };
  });
  items.sort((a, b) => a.name.text.localeCompare(b.name.text, lang));

  return {
    college: {
      ...toProvider(null, self.college, texts),
      lastChecked: c.lastChecked,
      sourceUrl: c.sourceUrl,
    },
    programs: items,
  };
}

// ---------------------------------------------------------------------------
// Scholarship search
// ---------------------------------------------------------------------------

export interface ScholarshipCard extends ScholarshipSummary {
  countryName: LocalText;
  covers: Cover[];
  amountText: LocalText | null;
}

export function scholarshipSearchQuery(
  db: Db,
  f: ScholarshipFilters,
  today: string,
  pageSize = PAGE_SIZE,
) {
  const s = scholarships;
  const upcoming = and(eq(s.rolling, false), isNotNull(s.deadline), gte(s.deadline, today));
  const open = or(eq(s.rolling, true), isNull(s.deadline), gte(s.deadline, today));
  // 0: fixed deadline still ahead, 1: rolling or no fixed deadline, 2: closed.
  const group = sql`case when ${upcoming} then 0 when ${open} then 1 else 2 end`;
  return db
    .select({
      scholarship: pick(s, [...scholarshipSummaryKeys, 'covers', 'amountText'] as const),
      total: sql<number>`count(*) over ()`,
    })
    .from(s)
    .where(
      all(
        eq(s.published, true),
        f.includeClosed ? undefined : open,
        f.countries.length > 0 ? inArray(s.countryCode, f.countries) : undefined,
        f.coverages.length > 0 ? inArray(s.coverage, f.coverages) : undefined,
        f.coversPreYear ? eq(s.coversPreYear, 'yes') : undefined,
        f.openToTurkmen ? eq(s.openToTurkmen, 'yes') : undefined,
      ),
    )
    .orderBy(
      asc(group),
      // Soonest first while open; the most recently closed first after that.
      asc(sql`case when ${group} = 2 then null else ${s.deadline} end`),
      desc(s.deadline),
      asc(s.id),
    )
    .limit(pageSize * f.page);
}

export async function searchScholarships(
  db: Db,
  f: ScholarshipFilters,
  { lang, today, pageSize = PAGE_SIZE }: SearchOptions,
): Promise<SearchPage<ScholarshipCard>> {
  const rows = await scholarshipSearchQuery(db, f, today, pageSize);
  const texts = await loadTexts(
    db,
    lang,
    {
      scholarship: rows.map((r) => r.scholarship.id),
      country: rows.map((r) => r.scholarship.countryCode),
    },
    ['name', 'amount_text'],
  );
  const total = rows[0]?.total ?? 0;
  return {
    items: rows.map(({ scholarship: s }) => ({
      ...scholarshipSummary(s, 'program', texts, today),
      countryName: texts.name('country', s.countryCode, s.countryCode),
      covers: s.covers,
      amountText: texts.get('scholarship', s.id, 'amount_text', s.amountText),
    })),
    total,
    page: f.page,
    pageSize,
    hasMore: total > rows.length,
  };
}

// ---------------------------------------------------------------------------
// Compare: paths to a bachelor's
// ---------------------------------------------------------------------------

export interface CompareColumn {
  key: string;
  bachelor: ProgramSummary & { requirements: ProgramRequirements };
  /** The pre-year of this path; null for direct entry. */
  preYear: ProgramSummary | null;
  /** Null when the bachelor's needs a pre-year and none is listed. */
  totalYears: number | null;
  entryGuaranteed: boolean | null;
  /** The pre-year was added because the bachelor's needs one (not picked by the student). */
  autoPreYear: boolean;
  openScholarships: number;
}

export interface ComparePage {
  columns: CompareColumn[];
  /** Items in the URL that are no longer listed (unpublished, wrong level, unknown pathway). */
  missing: number;
}

export async function getComparePage(
  db: Db,
  items: readonly CompareItem[],
  options: PageOptions,
): Promise<ComparePage> {
  const pages = await Promise.all(
    items.map((item) => getProgramPageById(db, item.bachelorId, options)),
  );
  const columns: CompareColumn[] = [];
  items.forEach((item, i) => {
    const page = pages[i];
    if (!page || page.program.level !== 'bachelor') return;
    const pathways = page.paths.flatMap((p) => (p.kind === 'pathway' ? [p] : []));
    const direct = page.paths.find((p) => p.kind === 'direct');
    const base = {
      key: compareKey(item),
      bachelor: page.program,
      openScholarships: page.scholarships.filter((s) => s.open).length,
    };

    if (item.preYearId !== null) {
      const chosen = pathways.find((p) => p.preYear.id === item.preYearId);
      if (!chosen) return;
      columns.push({
        ...base,
        preYear: chosen.preYear,
        totalYears: chosen.totalYears,
        entryGuaranteed: chosen.entryGuaranteed,
        autoPreYear: false,
      });
    } else if (page.program.preYearRequired === 'yes') {
      const shortest = pathways[0];
      columns.push({
        ...base,
        preYear: shortest?.preYear ?? null,
        totalYears: shortest?.totalYears ?? null,
        entryGuaranteed: shortest?.entryGuaranteed ?? null,
        // No published pre-year leads here: the column says it needs one, nothing more.
        autoPreYear: shortest !== undefined,
      });
    } else {
      columns.push({
        ...base,
        preYear: null,
        totalYears: direct?.totalYears ?? totalYears(null, page.program.durationYears),
        entryGuaranteed: null,
        autoPreYear: false,
      });
    }
  });
  return { columns, missing: items.length - columns.length };
}

// ---------------------------------------------------------------------------
// Home and filter options
// ---------------------------------------------------------------------------

export interface CountryOption {
  code: string;
  name: LocalText;
  popularRank: number | null;
}

/** Every country, popular ones first (by rank), then by name in the page language. */
export function countriesQuery(db: Db) {
  // Reads only countries_popular_idx (a covering index): no table scan.
  return db
    .select({ code: countries.code, popularRank: countries.popularRank })
    .from(countries)
    .orderBy(asc(countries.popularRank), asc(countries.code));
}

export async function getCountries(db: Db, lang: Lang): Promise<CountryOption[]> {
  const rows = await countriesQuery(db);
  const texts = await loadTexts(db, lang, { country: rows.map((r) => r.code) }, ['name']);
  return rows
    .map((r) => ({ ...r, name: texts.name('country', r.code, r.code) }))
    .sort(
      (a, b) =>
        (a.popularRank ?? Infinity) - (b.popularRank ?? Infinity) ||
        a.name.text.localeCompare(b.name.text, lang),
    );
}

/** Teaching languages of published programs, for the Language filter. */
export function studyLanguagesQuery(db: Db) {
  return db
    .selectDistinct({ code: programs.languageOfStudy })
    .from(programs)
    .where(eq(programs.published, true));
}

export async function getStudyLanguages(db: Db): Promise<string[]> {
  const rows = await studyLanguagesQuery(db);
  return rows.map((r) => r.code).sort();
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getUsdTmtRate(db: Db): Promise<UsdTmtRate | null> {
  const rows = await db
    .select()
    .from(settings)
    .where(inArray(settings.key, ['usd_tmt_rate', 'usd_tmt_rate_date']));
  const value = (key: string) => rows.find((r) => r.key === key)?.value;
  const rate = Number(value('usd_tmt_rate'));
  const date = value('usd_tmt_rate_date');
  return Number.isFinite(rate) && rate > 0 && date ? { rate, date } : null;
}

// ---------------------------------------------------------------------------
// Report a mistake
// ---------------------------------------------------------------------------

export const REPORTABLE = ['university', 'college', 'program', 'scholarship'] as const;
export type ReportableType = (typeof REPORTABLE)[number];

export interface ReportTarget {
  type: ReportableType;
  id: number;
  name: LocalText;
  /** Path under /[lang], e.g. `/programs/demo-u1-medicine`. */
  path: string;
}

/** The published record a report is about, or null. */
export async function findReportTarget(
  db: Db,
  lang: Lang,
  type: ReportableType,
  id: number,
): Promise<ReportTarget | null> {
  let row: { id: number; slug: string; name: string } | undefined;
  let prefix: string;
  if (type === 'program') {
    [row] = await db
      .select({ id: programs.id, slug: programs.slug, name: programs.name })
      .from(programs)
      .leftJoin(universities, eq(universities.id, programs.universityId))
      .leftJoin(pathwayColleges, eq(pathwayColleges.id, programs.collegeId))
      .where(and(eq(programs.id, id), mainVisible))
      .limit(1);
    prefix = '/programs/';
  } else if (type === 'university') {
    [row] = await db
      .select({ id: universities.id, slug: universities.slug, name: universities.name })
      .from(universities)
      .where(and(eq(universities.id, id), eq(universities.published, true)))
      .limit(1);
    prefix = '/universities/';
  } else if (type === 'college') {
    [row] = await db
      .select({ id: pathwayColleges.id, slug: pathwayColleges.slug, name: pathwayColleges.name })
      .from(pathwayColleges)
      .where(and(eq(pathwayColleges.id, id), eq(pathwayColleges.published, true)))
      .limit(1);
    prefix = '/colleges/';
  } else {
    [row] = await db
      .select({ id: scholarships.id, slug: scholarships.slug, name: scholarships.name })
      .from(scholarships)
      .where(and(eq(scholarships.id, id), eq(scholarships.published, true)))
      .limit(1);
    prefix = '/scholarships/';
  }
  if (!row) return null;
  const texts = await loadTexts(db, lang, { [type]: [row.id] }, ['name']);
  return {
    type,
    id: row.id,
    name: texts.name(type, row.id, row.name),
    path: `${prefix}${row.slug}`,
  };
}

export async function insertMistakeReport(
  db: Db,
  report: { type: ReportableType; id: number; message: string },
): Promise<void> {
  await db.insert(mistakeReports).values({
    entityType: report.type,
    entityId: String(report.id),
    message: report.message,
  });
}
