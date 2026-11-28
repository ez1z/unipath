/**
 * Programs in /admin: bachelor's, foundation and language years. Tuition left
 * empty means "Cost not confirmed" (never an estimate); requirements pre-fill
 * students' tracker tasks.
 */
import { and, asc, eq, like, lt, or, type SQL } from 'drizzle-orm';
import { pathwayColleges, programs, savedItems, universities } from '../../db/schema.ts';
import type { ProgramRequirements } from '../../db/schema.ts';
import {
  DOCUMENTS,
  FIELDS,
  PROGRAM_LEVELS,
  TRI_STATES,
  type DocumentCode,
} from '../../db/values.ts';
import { formatMonth } from '../../format.ts';
import { getTranslations } from '../../../i18n/index.ts';
import { auditInsert, diffOf } from '../audit.ts';
import { providerOptions } from '../choices.ts';
import {
  checkPublicRecord,
  flag,
  isDate,
  isStale,
  lastCheckedOnSave,
  lines,
  list,
  optionalInt,
  optionalNumber,
  slugify,
  staleBefore,
  text,
  translated,
  type FormErrors,
  type FormValues,
} from '../form.ts';
import {
  dbErrors,
  LIST_PAGE_SIZE,
  nextId,
  removeError,
  runBatch,
  type RecordType,
} from '../record-type.ts';
import { deleteTexts, readTexts, textStatements } from '../texts.ts';

type Level = (typeof PROGRAM_LEVELS)[number];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** "SAT: 1200" per line ⇄ { name, min }. */
export function parseOtherTests(value: string): ProgramRequirements['otherTests'] {
  return lines(value).map((line) => {
    const [name = '', ...rest] = line.split(':');
    const min = rest.join(':').trim();
    return { name: name.trim(), min: min || null };
  });
}

export function otherTestsText(tests: ProgramRequirements['otherTests']): string {
  return tests.map((t) => (t.min ? `${t.name}: ${t.min}` : t.name)).join('\n');
}

export const programsAdmin: RecordType = {
  type: 'programs',
  pluralKey: 'admin.type.programs',
  singularKey: 'admin.one.programs',
  filters: ['q', 'level', 'published', 'stale'],
  searchable: true,

  async list(db, lang, f, today) {
    const t = getTranslations(lang);
    const where: SQL[] = [];
    if (f.q) {
      const q = `%${f.q}%`;
      const match = or(
        like(programs.name, q),
        like(programs.slug, q),
        like(universities.name, q),
        like(pathwayColleges.name, q),
      );
      if (match) where.push(match);
    }
    if ((PROGRAM_LEVELS as readonly string[]).includes(f.level)) {
      where.push(eq(programs.level, f.level as Level));
    }
    if (f.published) where.push(eq(programs.published, f.published === 'yes'));
    if (f.stale) where.push(lt(programs.lastChecked, staleBefore(today)));
    const rows = await db
      .select({
        id: programs.id,
        slug: programs.slug,
        name: programs.name,
        level: programs.level,
        published: programs.published,
        lastChecked: programs.lastChecked,
        university: universities.name,
        college: pathwayColleges.name,
      })
      .from(programs)
      .leftJoin(universities, eq(universities.id, programs.universityId))
      .leftJoin(pathwayColleges, eq(pathwayColleges.id, programs.collegeId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(programs.name), asc(programs.id))
      .limit(LIST_PAGE_SIZE + 1)
      .offset((f.page - 1) * LIST_PAGE_SIZE);
    return {
      more: rows.length > LIST_PAGE_SIZE,
      rows: rows.slice(0, LIST_PAGE_SIZE).map((p) => ({
        id: p.id,
        title: p.name,
        details: `${p.university ?? p.college ?? ''} · ${t(`level.${p.level}`)}`,
        published: p.published,
        lastChecked: p.lastChecked,
        stale: isStale(p.lastChecked, today),
        publicPath: p.published ? `/programs/${p.slug}` : null,
      })),
    };
  },

  empty(today) {
    return {
      name: { en: '', tk: '', ru: '' },
      slug: '',
      provider: '',
      level: 'bachelor',
      field: '',
      language_of_study: 'en',
      duration_years: '',
      tuition_per_year_usd: '',
      intakes: [],
      application_deadline: '',
      pre_year_required: 'unknown',
      ielts_min: '',
      other_tests: '',
      documents: [],
      source_url: '',
      last_checked: today,
      published: false,
    };
  },

  async load(db, id) {
    const [p] = await db.select().from(programs).where(eq(programs.id, id)).limit(1);
    if (!p) return null;
    const texts = await readTexts(db, 'program', id, ['name']);
    return {
      name: { en: p.name, ...(texts['name'] ?? { tk: '', ru: '' }) },
      slug: p.slug,
      provider: p.universityId !== null ? `university:${p.universityId}` : `college:${p.collegeId}`,
      level: p.level,
      field: p.field ?? '',
      language_of_study: p.languageOfStudy,
      duration_years: String(p.durationYears),
      tuition_per_year_usd: p.tuitionPerYearUsd === null ? '' : String(p.tuitionPerYearUsd),
      intakes: p.intakes.map(String),
      application_deadline: p.applicationDeadline ?? '',
      pre_year_required: p.preYearRequired ?? '',
      ielts_min: p.requirements.ieltsMin === null ? '' : String(p.requirements.ieltsMin),
      other_tests: otherTestsText(p.requirements.otherTests),
      documents: [...p.requirements.documents],
      source_url: p.sourceUrl ?? '',
      last_checked: p.lastChecked,
      published: p.published,
    };
  },

  async sections(db, lang, t) {
    return [
      {
        legend: 'admin.section.basics',
        fields: [
          { kind: 'translated', name: 'name', label: 'admin.field.name', required: true },
          { kind: 'text', name: 'slug', label: 'admin.field.slug', hint: 'admin.hint.slug' },
          {
            kind: 'select',
            name: 'provider',
            label: 'admin.field.provider',
            options: await providerOptions(db, t),
            blank: 'admin.choose',
            required: true,
          },
          {
            kind: 'select',
            name: 'level',
            label: 'admin.field.level',
            options: PROGRAM_LEVELS.map((v) => ({ value: v, label: t(`level.${v}`) })),
            required: true,
          },
          {
            kind: 'select',
            name: 'field',
            label: 'admin.field.field',
            options: FIELDS.map((v) => ({ value: v, label: t(`field.${v}`) })),
            blank: 'admin.noField',
          },
          {
            kind: 'text',
            name: 'language_of_study',
            label: 'admin.field.languageOfStudy',
            hint: 'admin.hint.languageOfStudy',
            maxLength: 2,
            required: true,
          },
          {
            kind: 'number',
            name: 'duration_years',
            label: 'admin.field.durationYears',
            step: '0.5',
            min: 0.5,
            max: 8,
            required: true,
          },
          {
            kind: 'select',
            name: 'pre_year_required',
            label: 'admin.field.preYearRequired',
            hint: 'admin.hint.preYearRequired',
            options: TRI_STATES.map((v) => ({ value: v, label: t(`admin.tri.${v}`) })),
            blank: 'admin.notBachelor',
          },
        ],
      },
      {
        legend: 'admin.section.costAndDates',
        fields: [
          {
            kind: 'number',
            name: 'tuition_per_year_usd',
            label: 'admin.field.tuition',
            hint: 'admin.hint.tuition',
            step: '1',
            min: 0,
          },
          {
            kind: 'checkboxes',
            name: 'intakes',
            label: 'admin.field.intakes',
            options: MONTHS.map((m) => ({ value: String(m), label: formatMonth(lang, m) })),
          },
          {
            kind: 'date',
            name: 'application_deadline',
            label: 'admin.field.deadline',
            hint: 'admin.hint.deadline',
          },
        ],
      },
      {
        legend: 'admin.section.requirements',
        fields: [
          {
            kind: 'number',
            name: 'ielts_min',
            label: 'admin.field.ieltsMin',
            hint: 'admin.hint.ieltsMin',
            step: '0.5',
            min: 0,
            max: 9,
          },
          {
            kind: 'textarea',
            name: 'other_tests',
            label: 'admin.field.otherTests',
            hint: 'admin.hint.otherTests',
            rows: 3,
          },
          {
            kind: 'checkboxes',
            name: 'documents',
            label: 'admin.field.documents',
            options: DOCUMENTS.map((d) => ({ value: d, label: t(`doc.${d}`) })),
          },
        ],
      },
      {
        legend: 'admin.section.record',
        fields: [
          {
            kind: 'url',
            name: 'source_url',
            label: 'admin.field.sourceUrl',
            hint: 'admin.hint.sourceUrl',
          },
          {
            kind: 'date',
            name: 'last_checked',
            label: 'admin.field.lastChecked',
            hint: 'admin.hint.lastChecked',
          },
          { kind: 'checkbox', name: 'published', label: 'admin.field.published' },
        ],
      },
    ];
  },

  parse(form, today) {
    const name = translated(form, 'name');
    const level = text(form, 'level');
    const v = {
      slug: text(form, 'slug') || slugify(name.en),
      provider: text(form, 'provider'),
      level,
      field: text(form, 'field'),
      language_of_study: text(form, 'language_of_study').toLowerCase(),
      duration_years: text(form, 'duration_years'),
      tuition_per_year_usd: text(form, 'tuition_per_year_usd'),
      intakes: list(form, 'intakes'),
      application_deadline: text(form, 'application_deadline'),
      // Only bachelor's programs say whether a pre-year is needed.
      pre_year_required: level === 'bachelor' ? text(form, 'pre_year_required') || 'unknown' : '',
      ielts_min: text(form, 'ielts_min'),
      other_tests: text(form, 'other_tests'),
      documents: list(form, 'documents'),
      source_url: text(form, 'source_url'),
      last_checked: lastCheckedOnSave(form, today),
      published: flag(form, 'published'),
    };
    const values: FormValues = { name, ...v };
    const errors: FormErrors = {};
    checkPublicRecord(
      {
        slug: v.slug,
        name,
        sourceUrl: v.source_url,
        published: v.published,
        lastChecked: v.last_checked,
      },
      errors,
    );

    const provider = /^(university|college):(\d+)$/.exec(v.provider);
    if (!provider) errors['provider'] = { key: 'admin.error.required' };
    if (!(PROGRAM_LEVELS as readonly string[]).includes(level))
      errors['level'] = { key: 'admin.error.choice' };
    if (v.field && !(FIELDS as readonly string[]).includes(v.field))
      errors['field'] = { key: 'admin.error.choice' };
    if (!/^[a-z]{2}$/.test(v.language_of_study))
      errors['language_of_study'] = { key: 'admin.error.languageCode' };
    const duration = optionalNumber(v.duration_years, 0.5, 8);
    if (duration === null || duration === undefined)
      errors['duration_years'] = { key: 'admin.error.number' };
    const tuition = optionalInt(v.tuition_per_year_usd, 0, 1_000_000);
    if (tuition === undefined) errors['tuition_per_year_usd'] = { key: 'admin.error.number' };
    const intakes = v.intakes.map(Number);
    if (intakes.some((m) => !Number.isInteger(m) || m < 1 || m > 12))
      errors['intakes'] = { key: 'admin.error.choice' };
    if (v.application_deadline && !isDate(v.application_deadline)) {
      errors['application_deadline'] = { key: 'admin.error.date' };
    }
    if (v.pre_year_required && !(TRI_STATES as readonly string[]).includes(v.pre_year_required)) {
      errors['pre_year_required'] = { key: 'admin.error.choice' };
    }
    const ielts = optionalNumber(v.ielts_min, 0, 9);
    if (ielts === undefined) errors['ielts_min'] = { key: 'admin.error.number' };
    const documents = v.documents.filter((d): d is DocumentCode =>
      (DOCUMENTS as readonly string[]).includes(d),
    );
    const otherTests = parseOtherTests(v.other_tests);
    if (otherTests.some((t) => !t.name)) errors['other_tests'] = { key: 'admin.error.otherTests' };

    return {
      values,
      errors,
      async save(db, adminId, id, before) {
        const recordId = id ?? (await nextId(db, programs));
        const isUniversity = provider?.[1] === 'university';
        const providerId = Number(provider?.[2]);
        const row = {
          slug: v.slug,
          providerType: isUniversity ? ('university' as const) : ('college' as const),
          universityId: isUniversity ? providerId : null,
          collegeId: isUniversity ? null : providerId,
          level: level as Level,
          name: name.en,
          field: (v.field || null) as (typeof FIELDS)[number] | null,
          languageOfStudy: v.language_of_study,
          durationYears: duration ?? 0,
          tuitionPerYearUsd: tuition ?? null,
          intakes: [...new Set(intakes)].sort((a, b) => a - b),
          requirements: { ieltsMin: ielts ?? null, otherTests, documents },
          applicationDeadline: v.application_deadline || null,
          preYearRequired: (v.pre_year_required || null) as (typeof TRI_STATES)[number] | null,
          sourceUrl: v.source_url || null,
          lastChecked: v.last_checked,
          published: v.published,
        };
        try {
          await runBatch(db, [
            id === null
              ? db.insert(programs).values({ id: recordId, ...row })
              : db.update(programs).set(row).where(eq(programs.id, id)),
            ...textStatements(db, 'program', recordId, 'name', name),
            auditInsert(db, {
              adminId,
              action: id === null ? 'create' : 'update',
              entityType: 'program',
              entityId: recordId,
              diff: diffOf(before, values),
            }),
          ]);
          return { ok: true, id: recordId };
        } catch (error) {
          return { ok: false, errors: dbErrors(error) };
        }
      },
    };
  },

  async remove(db, adminId, id) {
    try {
      await runBatch(db, [
        db
          .delete(savedItems)
          .where(and(eq(savedItems.itemType, 'program'), eq(savedItems.itemId, id))),
        deleteTexts(db, 'program', id),
        db.delete(programs).where(eq(programs.id, id)),
        auditInsert(db, { adminId, action: 'delete', entityType: 'program', entityId: id }),
      ]);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: removeError(error) };
    }
  },

  publicPath(values, lang) {
    return values['published'] === true ? `/${lang}/programs/${String(values['slug'])}` : null;
  },
};
