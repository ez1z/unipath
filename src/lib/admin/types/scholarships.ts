/**
 * Scholarships in /admin (bachelor's level only), with the programs and
 * universities they can be used at. Unknown facts stay "unknown" (never a guess).
 */
import { and, asc, eq, like, lt, or, type SQL } from 'drizzle-orm';
import { getTranslations } from '../../../i18n/index.ts';
import {
  savedItems,
  scholarshipPrograms,
  scholarships,
  scholarshipUniversities,
} from '../../db/schema.ts';
import { COVERAGES, COVERS, TRI_STATES, type Cover } from '../../db/values.ts';
import { auditInsert, diffOf } from '../audit.ts';
import { countryOptions, programOptions, universityOptions } from '../choices.ts';
import {
  checkPublicRecord,
  flag,
  isDate,
  isStale,
  lastCheckedOnSave,
  lines,
  list,
  slugify,
  staleBefore,
  text,
  translated,
  type FormErrors,
  type FormValues,
  type Translated,
} from '../form.ts';
import {
  dbErrors,
  LIST_PAGE_SIZE,
  nextId,
  removeError,
  runBatch,
  type RecordType,
} from '../record-type.ts';
import { deleteTexts, listTextToLines, readTexts, textStatements } from '../texts.ts';

type Tri = (typeof TRI_STATES)[number];
const ids = (values: string[]) =>
  [...new Set(values.map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort(
    (a, b) => a - b,
  );

export const scholarshipsAdmin: RecordType = {
  type: 'scholarships',
  pluralKey: 'admin.type.scholarships',
  singularKey: 'admin.one.scholarships',
  filters: ['q', 'country', 'published', 'stale'],
  searchable: false,

  async list(db, lang, f, today) {
    const t = getTranslations(lang);
    const where: SQL[] = [];
    if (f.q) {
      const q = `%${f.q}%`;
      const match = or(
        like(scholarships.name, q),
        like(scholarships.slug, q),
        like(scholarships.provider, q),
      );
      if (match) where.push(match);
    }
    if (f.country) where.push(eq(scholarships.countryCode, f.country));
    if (f.published) where.push(eq(scholarships.published, f.published === 'yes'));
    if (f.stale) where.push(lt(scholarships.lastChecked, staleBefore(today)));
    const rows = await db
      .select()
      .from(scholarships)
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(scholarships.name))
      .limit(LIST_PAGE_SIZE + 1)
      .offset((f.page - 1) * LIST_PAGE_SIZE);
    return {
      more: rows.length > LIST_PAGE_SIZE,
      rows: rows.slice(0, LIST_PAGE_SIZE).map((s) => ({
        id: s.id,
        title: s.name,
        details: [
          s.provider,
          s.countryCode,
          t(`coverage.${s.coverage}`),
          s.rolling ? t('admin.field.rolling') : (s.deadline ?? t('admin.noDeadline')),
        ].join(' · '),
        published: s.published,
        lastChecked: s.lastChecked,
        stale: isStale(s.lastChecked, today),
        publicPath: s.published ? `/scholarships/${s.slug}` : null,
      })),
    };
  },

  empty(today) {
    return {
      name: { en: '', tk: '', ru: '' },
      slug: '',
      provider: '',
      country_code: '',
      coverage: 'partial',
      covers: [],
      covers_pre_year: 'unknown',
      amount_text: { en: '', tk: '', ru: '' },
      deadline: '',
      rolling: false,
      open_to_turkmen: 'unknown',
      eligibility: { en: '', tk: '', ru: '' },
      how_to_apply: { en: '', tk: '', ru: '' },
      programs: [],
      universities: [],
      source_url: '',
      last_checked: today,
      published: false,
    };
  },

  async load(db, id) {
    const [s] = await db.select().from(scholarships).where(eq(scholarships.id, id)).limit(1);
    if (!s) return null;
    const [texts, programRows, universityRows] = await Promise.all([
      readTexts(db, 'scholarship', id, ['name', 'amount_text', 'eligibility', 'how_to_apply']),
      db
        .select({ id: scholarshipPrograms.programId })
        .from(scholarshipPrograms)
        .where(eq(scholarshipPrograms.scholarshipId, id)),
      db
        .select({ id: scholarshipUniversities.universityId })
        .from(scholarshipUniversities)
        .where(eq(scholarshipUniversities.scholarshipId, id)),
    ]);
    const other = (field: string) => texts[field] ?? { tk: '', ru: '' };
    const eligibility = other('eligibility');
    return {
      name: { en: s.name, ...other('name') },
      slug: s.slug,
      provider: s.provider,
      country_code: s.countryCode,
      coverage: s.coverage,
      covers: [...s.covers],
      covers_pre_year: s.coversPreYear,
      amount_text: { en: s.amountText ?? '', ...other('amount_text') },
      deadline: s.deadline ?? '',
      rolling: s.rolling,
      open_to_turkmen: s.openToTurkmen,
      eligibility: {
        en: s.eligibility.join('\n'),
        tk: listTextToLines(eligibility.tk),
        ru: listTextToLines(eligibility.ru),
      },
      how_to_apply: { en: s.howToApply ?? '', ...other('how_to_apply') },
      programs: programRows.map((r) => String(r.id)),
      universities: universityRows.map((r) => String(r.id)),
      source_url: s.sourceUrl ?? '',
      last_checked: s.lastChecked,
      published: s.published,
    };
  },

  async sections(db, lang, t) {
    const tri = TRI_STATES.map((v) => ({ value: v, label: t(`admin.tri.${v}`) }));
    return [
      {
        legend: 'admin.section.basics',
        fields: [
          { kind: 'translated', name: 'name', label: 'admin.field.name', required: true },
          { kind: 'text', name: 'slug', label: 'admin.field.slug', hint: 'admin.hint.slug' },
          {
            kind: 'text',
            name: 'provider',
            label: 'admin.field.scholarshipProvider',
            required: true,
          },
          {
            kind: 'select',
            name: 'country_code',
            label: 'admin.field.country',
            options: await countryOptions(db, lang),
            blank: 'admin.choose',
            required: true,
          },
        ],
      },
      {
        legend: 'admin.section.coverage',
        fields: [
          {
            kind: 'select',
            name: 'coverage',
            label: 'admin.field.coverage',
            options: COVERAGES.map((v) => ({ value: v, label: t(`coverage.${v}`) })),
            required: true,
          },
          {
            kind: 'checkboxes',
            name: 'covers',
            label: 'admin.field.covers',
            options: COVERS.map((v) => ({ value: v, label: t(`covers.${v}`) })),
          },
          {
            kind: 'select',
            name: 'covers_pre_year',
            label: 'admin.field.coversPreYear',
            options: tri,
            required: true,
          },
          {
            kind: 'translated',
            name: 'amount_text',
            label: 'admin.field.amountText',
            hint: 'admin.hint.amountText',
          },
        ],
      },
      {
        legend: 'admin.section.eligibility',
        fields: [
          {
            kind: 'select',
            name: 'open_to_turkmen',
            label: 'admin.field.openToTurkmen',
            options: tri,
            required: true,
          },
          {
            kind: 'date',
            name: 'deadline',
            label: 'admin.field.deadline',
            hint: 'admin.hint.deadline',
          },
          {
            kind: 'checkbox',
            name: 'rolling',
            label: 'admin.field.rolling',
            hint: 'admin.hint.rolling',
          },
          {
            kind: 'translated',
            name: 'eligibility',
            label: 'admin.field.eligibility',
            hint: 'admin.hint.eligibility',
            multiline: true,
            rows: 5,
          },
          {
            kind: 'translated',
            name: 'how_to_apply',
            label: 'admin.field.howToApply',
            multiline: true,
            rows: 4,
          },
        ],
      },
      {
        legend: 'admin.section.validAt',
        fields: [
          {
            kind: 'multiselect',
            name: 'programs',
            label: 'admin.field.scholarshipPrograms',
            hint: 'admin.hint.multiselect',
            options: await programOptions(db, t, 'bachelor'),
            size: 8,
          },
          {
            kind: 'multiselect',
            name: 'universities',
            label: 'admin.field.scholarshipUniversities',
            hint: 'admin.hint.scholarshipUniversities',
            options: await universityOptions(db, t),
            size: 6,
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
    const amountText: Translated = translated(form, 'amount_text');
    const howToApply: Translated = translated(form, 'how_to_apply');
    const eligibility: Translated = {
      en: lines(text(form, 'eligibility_en')).join('\n'),
      tk: lines(text(form, 'eligibility_tk')).join('\n'),
      ru: lines(text(form, 'eligibility_ru')).join('\n'),
    };
    const v = {
      slug: text(form, 'slug') || slugify(name.en),
      provider: text(form, 'provider'),
      country_code: text(form, 'country_code').toUpperCase(),
      coverage: text(form, 'coverage'),
      covers: list(form, 'covers'),
      covers_pre_year: text(form, 'covers_pre_year'),
      deadline: text(form, 'deadline'),
      rolling: flag(form, 'rolling'),
      open_to_turkmen: text(form, 'open_to_turkmen'),
      programs: ids(list(form, 'programs')).map(String),
      universities: ids(list(form, 'universities')).map(String),
      source_url: text(form, 'source_url'),
      last_checked: lastCheckedOnSave(form, today),
      published: flag(form, 'published'),
    };
    const values: FormValues = {
      name,
      amount_text: amountText,
      how_to_apply: howToApply,
      eligibility,
      ...v,
    };
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
    if (!v.provider) errors['provider'] = { key: 'admin.error.required' };
    if (!/^[A-Z]{2}$/.test(v.country_code))
      errors['country_code'] = { key: 'admin.error.required' };
    if (!(COVERAGES as readonly string[]).includes(v.coverage))
      errors['coverage'] = { key: 'admin.error.choice' };
    const covers = v.covers.filter((c): c is Cover => (COVERS as readonly string[]).includes(c));
    for (const key of ['covers_pre_year', 'open_to_turkmen'] as const) {
      if (!(TRI_STATES as readonly string[]).includes(v[key]))
        errors[key] = { key: 'admin.error.choice' };
    }
    if (v.deadline && !isDate(v.deadline)) errors['deadline'] = { key: 'admin.error.date' };

    return {
      values,
      errors,
      async save(db, adminId, id, before) {
        const recordId = id ?? (await nextId(db, scholarships));
        const row = {
          slug: v.slug,
          name: name.en,
          provider: v.provider,
          countryCode: v.country_code,
          coverage: v.coverage as (typeof COVERAGES)[number],
          covers,
          coversPreYear: v.covers_pre_year as Tri,
          amountText: amountText.en || null,
          deadline: v.deadline || null,
          rolling: v.rolling,
          openToTurkmen: v.open_to_turkmen as Tri,
          eligibility: lines(eligibility.en),
          howToApply: howToApply.en || null,
          sourceUrl: v.source_url || null,
          lastChecked: v.last_checked,
          published: v.published,
        };
        const programIds = v.programs.map(Number);
        const universityIds = v.universities.map(Number);
        try {
          await runBatch(db, [
            id === null
              ? db.insert(scholarships).values({ id: recordId, ...row })
              : db.update(scholarships).set(row).where(eq(scholarships.id, id)),
            db.delete(scholarshipPrograms).where(eq(scholarshipPrograms.scholarshipId, recordId)),
            db
              .delete(scholarshipUniversities)
              .where(eq(scholarshipUniversities.scholarshipId, recordId)),
            ...programIds.map((programId) =>
              db.insert(scholarshipPrograms).values({ scholarshipId: recordId, programId }),
            ),
            ...universityIds.map((universityId) =>
              db.insert(scholarshipUniversities).values({ scholarshipId: recordId, universityId }),
            ),
            ...textStatements(db, 'scholarship', recordId, 'name', name),
            ...textStatements(db, 'scholarship', recordId, 'amount_text', amountText),
            ...textStatements(db, 'scholarship', recordId, 'how_to_apply', howToApply),
            ...textStatements(db, 'scholarship', recordId, 'eligibility', eligibility, {
              list: true,
            }),
            auditInsert(db, {
              adminId,
              action: id === null ? 'create' : 'update',
              entityType: 'scholarship',
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
          .where(and(eq(savedItems.itemType, 'scholarship'), eq(savedItems.itemId, id))),
        deleteTexts(db, 'scholarship', id),
        db.delete(scholarships).where(eq(scholarships.id, id)),
        auditInsert(db, { adminId, action: 'delete', entityType: 'scholarship', entityId: id }),
      ]);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: removeError(error) };
    }
  },

  publicPath(values, lang) {
    return values['published'] === true ? `/${lang}/scholarships/${String(values['slug'])}` : null;
  },
};
