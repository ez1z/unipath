/**
 * Turns a "clavis-records/1" file into SQL statements and a report.
 *
 * - Everything is inserted with `published = 0`: an admin reviews each draft
 *   and publishes it in /admin. Nothing is ever published by an import.
 * - Records whose slug already exists are skipped (never overwritten) and
 *   listed in the report.
 * - Any problem (bad field, unknown country, a slug that points nowhere, an
 *   impossible pathway) stops the whole import: nothing is written.
 * - Ids are looked up by slug inside the SQL, so the same statements run on
 *   the local D1 or, as a file, on another database.
 */
import { z } from 'zod';
import { sqlValue } from '../backup.ts';
import type { ProgramLevel } from '../db/values.ts';
import {
  recordsFile,
  type CollegeRecord,
  type ProgramRecord,
  type RecordsFile,
  type ScholarshipRecord,
  type UniversityRecord,
} from './records.ts';

export type ImportType = 'university' | 'college' | 'program' | 'pathway' | 'scholarship';

/** What the target database already holds. `null` = unknown (writing a file for another database). */
export interface ImportTarget {
  countries: Set<string>;
  universities: Set<string>;
  colleges: Set<string>;
  /** slug → level */
  programs: Map<string, ProgramLevel>;
  scholarships: Set<string>;
  /** `from-slug>to-slug` */
  pathways: Set<string>;
}

export interface ImportReport {
  created: { type: ImportType; key: string }[];
  skipped: { type: ImportType; key: string; reason: 'exists' }[];
  problems: { path: string; message: string }[];
  /** Only for --sql files: slugs that must already exist in the target database. */
  assumed: { type: 'country' | ImportType; key: string }[];
}

export interface ImportPlan {
  report: ImportReport;
  statements: string[];
}

const TABLE: Record<Exclude<ImportType, 'pathway'>, string> = {
  university: 'universities',
  college: 'pathway_colleges',
  program: 'programs',
  scholarship: 'scholarships',
};

const v = sqlValue;
const idOf = (type: Exclude<ImportType, 'pathway'>, slug: string) =>
  `(SELECT id FROM ${TABLE[type]} WHERE slug = ${v(slug)})`;
const textIdOf = (type: Exclude<ImportType, 'pathway'>, slug: string) =>
  `(SELECT CAST(id AS TEXT) FROM ${TABLE[type]} WHERE slug = ${v(slug)})`;

function insert(table: string, row: Record<string, string>): string {
  return `INSERT INTO ${table} (${Object.keys(row).join(', ')}) VALUES (${Object.values(row).join(', ')});`;
}

function translationRows(
  type: Exclude<ImportType, 'pathway'>,
  slug: string,
  field: string,
  values: { tk?: string | string[] | undefined; ru?: string | string[] | undefined } | undefined,
): string[] {
  const out: string[] = [];
  for (const lang of ['tk', 'ru'] as const) {
    const value = values?.[lang];
    if (value === undefined || (Array.isArray(value) && value.length === 0)) continue;
    const stored = Array.isArray(value) ? JSON.stringify(value) : value;
    out.push(
      insert('translations', {
        entity_type: v(type),
        entity_id: textIdOf(type, slug),
        lang: v(lang),
        field: v(field),
        text: v(stored),
      }),
    );
  }
  return out;
}

function auditRow(type: ImportType, entityId: string, source: string | undefined, file: string) {
  return insert('audit_log', {
    admin_id: 'NULL',
    action: v('import'),
    entity_type: v(type),
    entity_id: entityId,
    diff: v(JSON.stringify({ file, ...(source ? { source } : {}) })),
  });
}

const facts = (
  r: { source_url?: string | null | undefined; last_checked?: string | undefined },
  today: string,
) => ({
  source_url: v(r.source_url ?? null),
  last_checked: v(r.last_checked ?? today),
  published: '0',
});

/** Zod issues as "universities[2].name.en: …". */
function zodProblems(error: z.ZodError): ImportReport['problems'] {
  return error.issues.map((issue) => ({
    path: issue.path
      .map((p, i) => (typeof p === 'number' ? `[${p}]` : i === 0 ? String(p) : `.${String(p)}`))
      .join(''),
    message: issue.message,
  }));
}

export function planImport(
  input: unknown,
  target: ImportTarget | null,
  { today, file = 'import.json' }: { today: string; file?: string },
): ImportPlan {
  const report: ImportReport = { created: [], skipped: [], problems: [], assumed: [] };
  const parsed = recordsFile.safeParse(input);
  if (!parsed.success) {
    report.problems = zodProblems(parsed.error);
    return { report, statements: [] };
  }
  const data: RecordsFile = parsed.data;
  const problem = (path: string, message: string) => report.problems.push({ path, message });
  const assumed = new Set<string>();
  const assume = (type: ImportReport['assumed'][number]['type'], key: string) => {
    if (!assumed.has(`${type}:${key}`)) {
      assumed.add(`${type}:${key}`);
      report.assumed.push({ type, key });
    }
  };

  // Slugs this file creates (after skipping the ones that exist).
  const fresh = {
    university: new Set<string>(),
    college: new Set<string>(),
    program: new Map<string, ProgramLevel>(),
    scholarship: new Set<string>(),
  };
  const existing = (type: Exclude<ImportType, 'pathway'>, slug: string): boolean => {
    if (!target) return false;
    if (type === 'program') return target.programs.has(slug);
    return (
      type === 'university'
        ? target.universities
        : type === 'college'
          ? target.colleges
          : target.scholarships
    ).has(slug);
  };

  function claim<T extends { slug: string }>(
    type: Exclude<ImportType, 'pathway'>,
    list: T[],
    group: string,
  ): T[] {
    const seen = new Set<string>();
    const kept: T[] = [];
    list.forEach((record, i) => {
      if (seen.has(record.slug)) {
        problem(`${group}[${i}].slug`, `"${record.slug}" appears twice in this file`);
        return;
      }
      seen.add(record.slug);
      if (existing(type, record.slug)) {
        report.skipped.push({ type, key: record.slug, reason: 'exists' });
        return;
      }
      kept.push(record);
    });
    return kept;
  }

  const universities = claim('university', data.universities, 'universities');
  const colleges = claim('college', data.colleges, 'colleges');
  const programs = claim('program', data.programs, 'programs');
  const scholarships = claim('scholarship', data.scholarships, 'scholarships');
  universities.forEach((u) => fresh.university.add(u.slug));
  colleges.forEach((c) => fresh.college.add(c.slug));
  programs.forEach((p) => fresh.program.set(p.slug, p.level));
  scholarships.forEach((s) => fresh.scholarship.add(s.slug));

  const checkCountry = (path: string, code: string) => {
    if (!target) assume('country', code);
    else if (!target.countries.has(code)) problem(path, `country "${code}" is not in Clavis`);
  };
  /** True if the slug is in this file or the target; for --sql files, assumed to exist. */
  const resolves = (type: 'university' | 'college' | 'scholarship', slug: string) => {
    if (fresh[type].has(slug)) return true;
    if (!target) {
      assume(type, slug);
      return true;
    }
    return existing(type, slug);
  };
  /** The program's level, 'assumed' for --sql files, or null if it isn't anywhere. */
  const programLevel = (slug: string): ProgramLevel | 'assumed' | null => {
    const level = fresh.program.get(slug) ?? target?.programs.get(slug);
    if (level) return level;
    if (!target) {
      assume('program', slug);
      return 'assumed';
    }
    return null;
  };

  data.universities.forEach((u, i) => {
    if (!universities.includes(u)) return;
    checkCountry(`universities[${i}].country`, u.country);
    if (u.ministry_status === 'approved' && !u.ministry_basis) {
      problem(
        `universities[${i}].ministry_basis`,
        '"approved" needs the basis (which list, order or letter)',
      );
    }
  });
  data.colleges.forEach((c, i) => {
    if (colleges.includes(c)) checkCountry(`colleges[${i}].country`, c.country);
  });
  data.programs.forEach((p, i) => {
    if (!programs.includes(p)) return;
    const at = `programs[${i}]`;
    if (!!p.university === !!p.college)
      problem(at, 'give exactly one of "university" or "college"');
    else if (p.university && !resolves('university', p.university)) {
      problem(`${at}.university`, `no university "${p.university}"`);
    } else if (p.college && !resolves('college', p.college)) {
      problem(`${at}.college`, `no college "${p.college}"`);
    }
    if (p.level !== 'bachelor' && p.pre_year_required) {
      problem(
        `${at}.pre_year_required`,
        "only bachelor's programs say whether a pre-year is needed",
      );
    }
    if (p.level === 'language' && p.field) problem(`${at}.field`, 'language years have no field');
  });
  const pairs = new Set<string>();
  const pathways = data.pathways.filter((p, i) => {
    const at = `pathways[${i}]`;
    const key = `${p.from}>${p.to}`;
    if (pairs.has(key)) {
      problem(at, 'this pathway appears twice in this file');
      return false;
    }
    pairs.add(key);
    if (target?.pathways.has(key)) {
      report.skipped.push({ type: 'pathway', key, reason: 'exists' });
      return false;
    }
    const from = programLevel(p.from);
    const to = programLevel(p.to);
    if (from === null) problem(`${at}.from`, `no program "${p.from}"`);
    else if (from === 'bachelor')
      problem(`${at}.from`, `"${p.from}" must be a foundation or language program`);
    if (to === null) problem(`${at}.to`, `no program "${p.to}"`);
    else if (to !== 'bachelor' && to !== 'assumed')
      problem(`${at}.to`, `"${p.to}" must be a bachelor's program`);
    return true;
  });
  data.scholarships.forEach((s, i) => {
    if (!scholarships.includes(s)) return;
    const at = `scholarships[${i}]`;
    checkCountry(`${at}.country`, s.country);
    s.programs.forEach((slug, j) => {
      const level = programLevel(slug);
      if (level === null) problem(`${at}.programs[${j}]`, `no program "${slug}"`);
      else if (level !== 'bachelor' && level !== 'assumed') {
        problem(`${at}.programs[${j}]`, `"${slug}" is not a bachelor's program`);
      }
    });
    s.universities.forEach((slug, j) => {
      if (!resolves('university', slug))
        problem(`${at}.universities[${j}]`, `no university "${slug}"`);
    });
  });

  if (report.problems.length > 0) {
    report.skipped = [];
    report.assumed = [];
    return { report, statements: [] };
  }

  const statements: string[] = [];
  const add = (type: Exclude<ImportType, 'pathway'>, slug: string, rows: string[]) => {
    statements.push(...rows, auditRow(type, textIdOf(type, slug), data.source, file));
  };

  for (const u of universities) add('university', u.slug, universitySql(u, today));
  for (const c of colleges) add('college', c.slug, collegeSql(c, today));
  for (const p of programs) add('program', p.slug, programSql(p, today));
  for (const p of pathways) {
    statements.push(
      insert('pathways', {
        from_program_id: idOf('program', p.from),
        to_program_id: idOf('program', p.to),
        entry_guaranteed: p.entry_guaranteed ? '1' : '0',
      }),
      auditRow(
        'pathway',
        `(SELECT CAST(id AS TEXT) FROM pathways WHERE from_program_id = ${idOf('program', p.from)} AND to_program_id = ${idOf('program', p.to)})`,
        data.source,
        file,
      ),
    );
  }
  for (const s of scholarships) add('scholarship', s.slug, scholarshipSql(s, today));

  report.created = [
    ...universities.map((r) => ({ type: 'university' as const, key: r.slug })),
    ...colleges.map((r) => ({ type: 'college' as const, key: r.slug })),
    ...programs.map((r) => ({ type: 'program' as const, key: r.slug })),
    ...pathways.map((r) => ({ type: 'pathway' as const, key: `${r.from}>${r.to}` })),
    ...scholarships.map((r) => ({ type: 'scholarship' as const, key: r.slug })),
  ];
  return { report, statements };
}

function universitySql(u: UniversityRecord, today: string): string[] {
  return [
    insert('universities', {
      slug: v(u.slug),
      name: v(u.name.en),
      country_code: v(u.country),
      city: v(u.city),
      type: v(u.type ?? null),
      website: v(u.website ?? null),
      ministry_status: v(u.ministry_status),
      ministry_basis: v(u.ministry_basis ?? null),
      ranking_qs: v(u.rankings?.qs ?? null),
      ranking_the: v(u.rankings?.the ?? null),
      ranking_arwu: v(u.rankings?.arwu ?? null),
      ranking_moscow: v(u.rankings?.moscow ?? null),
      ...facts(u, today),
    }),
    ...translationRows('university', u.slug, 'name', u.name),
  ];
}

function collegeSql(c: CollegeRecord, today: string): string[] {
  return [
    insert('pathway_colleges', {
      slug: v(c.slug),
      name: v(c.name.en),
      country_code: v(c.country),
      city: v(c.city),
      website: v(c.website ?? null),
      ...facts(c, today),
    }),
    ...translationRows('college', c.slug, 'name', c.name),
  ];
}

function programSql(p: ProgramRecord, today: string): string[] {
  const requirements = {
    ieltsMin: p.requirements?.ielts_min ?? null,
    otherTests: (p.requirements?.other_tests ?? []).map((t) => ({
      name: t.name,
      min: t.min ?? null,
    })),
    documents: [...new Set(p.requirements?.documents ?? [])],
  };
  return [
    insert('programs', {
      slug: v(p.slug),
      provider_type: v(p.university ? 'university' : 'college'),
      university_id: p.university ? idOf('university', p.university) : 'NULL',
      college_id: p.college ? idOf('college', p.college) : 'NULL',
      level: v(p.level),
      name: v(p.name.en),
      field: v(p.field ?? null),
      language_of_study: v(p.language_of_study),
      duration_years: v(p.duration_years),
      tuition_per_year_usd: v(p.tuition_per_year_usd ?? null),
      intakes: v(JSON.stringify([...new Set(p.intakes)].sort((a, b) => a - b))),
      requirements: v(JSON.stringify(requirements)),
      application_deadline: v(p.application_deadline ?? null),
      pre_year_required: v(p.level === 'bachelor' ? (p.pre_year_required ?? 'unknown') : null),
      ...facts(p, today),
    }),
    ...translationRows('program', p.slug, 'name', p.name),
  ];
}

function scholarshipSql(s: ScholarshipRecord, today: string): string[] {
  return [
    insert('scholarships', {
      slug: v(s.slug),
      name: v(s.name.en),
      provider: v(s.provider),
      country_code: v(s.country),
      coverage: v(s.coverage),
      covers: v(JSON.stringify([...new Set(s.covers)])),
      covers_pre_year: v(s.covers_pre_year),
      amount_text: v(s.amount_text?.en ?? null),
      deadline: v(s.deadline ?? null),
      rolling: s.rolling ? '1' : '0',
      open_to_turkmen: v(s.open_to_turkmen),
      eligibility: v(JSON.stringify(s.eligibility?.en ?? [])),
      how_to_apply: v(s.how_to_apply?.en ?? null),
      ...facts(s, today),
    }),
    ...translationRows('scholarship', s.slug, 'name', s.name),
    ...translationRows('scholarship', s.slug, 'amount_text', s.amount_text),
    ...translationRows('scholarship', s.slug, 'eligibility', s.eligibility),
    ...translationRows('scholarship', s.slug, 'how_to_apply', s.how_to_apply),
    ...[...new Set(s.programs)].map((slug) =>
      insert('scholarship_programs', {
        scholarship_id: idOf('scholarship', s.slug),
        program_id: idOf('program', slug),
      }),
    ),
    ...[...new Set(s.universities)].map((slug) =>
      insert('scholarship_universities', {
        scholarship_id: idOf('scholarship', s.slug),
        university_id: idOf('university', slug),
      }),
    ),
  ];
}

/** What the local database holds, for planImport. */
export async function loadImportTarget(d1: D1Database): Promise<ImportTarget> {
  const [countries, universities, colleges, programs, scholarships, pathways] = await d1.batch<
    Record<string, string>
  >([
    d1.prepare('SELECT code AS k FROM countries'),
    d1.prepare('SELECT slug AS k FROM universities'),
    d1.prepare('SELECT slug AS k FROM pathway_colleges'),
    d1.prepare('SELECT slug AS k, level FROM programs'),
    d1.prepare('SELECT slug AS k FROM scholarships'),
    d1.prepare(
      `SELECT f.slug || '>' || t.slug AS k FROM pathways p
       JOIN programs f ON f.id = p.from_program_id JOIN programs t ON t.id = p.to_program_id`,
    ),
  ]);
  const keys = (r: D1Result<Record<string, string>> | undefined) =>
    new Set((r?.results ?? []).map((row) => String(row['k'])));
  return {
    countries: keys(countries),
    universities: keys(universities),
    colleges: keys(colleges),
    programs: new Map(
      (programs?.results ?? []).map((row) => [String(row['k']), row['level'] as ProgramLevel]),
    ),
    scholarships: keys(scholarships),
    pathways: keys(pathways),
  };
}

/** The report as plain text for the terminal. */
export function formatReport(report: ImportReport, { dryRun = false } = {}): string {
  const lines: string[] = [];
  if (report.problems.length > 0) {
    lines.push(`Nothing was imported: ${report.problems.length} problem(s).`);
    for (const p of report.problems) lines.push(`  ${p.path || '(file)'}: ${p.message}`);
    return lines.join('\n');
  }
  lines.push(
    `${dryRun ? 'Drafts to create' : 'Drafts created'}: ${report.created.length} (all unpublished; review and publish them in /admin).`,
  );
  for (const c of report.created) lines.push(`  + ${c.type} ${c.key}`);
  lines.push(`Skipped, already in the database: ${report.skipped.length}`);
  for (const s of report.skipped) lines.push(`  = ${s.type} ${s.key}`);
  if (report.assumed.length > 0) {
    lines.push(`Must already exist in the target database: ${report.assumed.length}`);
    for (const a of report.assumed) lines.push(`  ? ${a.type} ${a.key}`);
  }
  return lines.join('\n');
}
