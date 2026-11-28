/**
 * Universities in /admin, with the Ministry status editor (status, basis and
 * the four ranking columns) on the same form.
 */
import { and, asc, eq, like, lt, or, type SQL } from 'drizzle-orm';
import { getTranslations, type MessageKey } from '../../../i18n/index.ts';
import { savedItems, universities } from '../../db/schema.ts';
import { MINISTRY_STATUSES, UNIVERSITY_TYPES } from '../../db/values.ts';
import { auditInsert, diffOf } from '../audit.ts';
import { countryOptions } from '../choices.ts';
import { PUBLIC_IMAGE_KEY } from '../images.ts';
import {
  checkPublicRecord,
  flag,
  isHttpUrl,
  isStale,
  lastCheckedOnSave,
  optionalInt,
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
import { deleteTexts, readTexts, textStatements } from '../texts.ts';

const RANKINGS = [
  ['ranking_qs', 'admin.field.rankingQs'],
  ['ranking_the', 'admin.field.rankingThe'],
  ['ranking_arwu', 'admin.field.rankingArwu'],
  ['ranking_moscow', 'admin.field.rankingMoscow'],
] as const satisfies readonly (readonly [string, MessageKey])[];

const intText = (n: number | null) => (n === null ? '' : String(n));

export const universitiesAdmin: RecordType = {
  type: 'universities',
  pluralKey: 'admin.type.universities',
  singularKey: 'admin.one.universities',
  filters: ['q', 'country', 'status', 'published', 'stale'],
  searchable: true,

  async list(db, lang, f, today) {
    const t = getTranslations(lang);
    const where: SQL[] = [];
    if (f.q) {
      const q = `%${f.q}%`;
      const match = or(like(universities.name, q), like(universities.slug, q));
      if (match) where.push(match);
    }
    if (f.country) where.push(eq(universities.countryCode, f.country));
    if ((MINISTRY_STATUSES as readonly string[]).includes(f.status)) {
      where.push(eq(universities.ministryStatus, f.status as (typeof MINISTRY_STATUSES)[number]));
    }
    if (f.published) where.push(eq(universities.published, f.published === 'yes'));
    if (f.stale) where.push(lt(universities.lastChecked, staleBefore(today)));
    const rows = await db
      .select()
      .from(universities)
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(universities.name))
      .limit(LIST_PAGE_SIZE + 1)
      .offset((f.page - 1) * LIST_PAGE_SIZE);
    return {
      more: rows.length > LIST_PAGE_SIZE,
      rows: rows.slice(0, LIST_PAGE_SIZE).map((u) => ({
        id: u.id,
        title: u.name,
        details: `${u.countryCode} · ${u.city} · ${t(`ministry.${u.ministryStatus}`)}`,
        published: u.published,
        lastChecked: u.lastChecked,
        stale: isStale(u.lastChecked, today),
        publicPath: u.published ? `/universities/${u.slug}` : null,
      })),
    };
  },

  empty(today) {
    return {
      name: { en: '', tk: '', ru: '' },
      slug: '',
      country_code: '',
      city: '',
      type: '',
      website: '',
      logo_key: '',
      photo_key: '',
      ministry_status: 'unchecked',
      ministry_basis: '',
      ranking_qs: '',
      ranking_the: '',
      ranking_arwu: '',
      ranking_moscow: '',
      source_url: '',
      last_checked: today,
      published: false,
    };
  },

  async load(db, id) {
    const [u] = await db.select().from(universities).where(eq(universities.id, id)).limit(1);
    if (!u) return null;
    const texts = await readTexts(db, 'university', id, ['name']);
    return {
      name: { en: u.name, ...(texts['name'] ?? { tk: '', ru: '' }) },
      slug: u.slug,
      country_code: u.countryCode,
      city: u.city,
      type: u.type ?? '',
      website: u.website ?? '',
      logo_key: u.logoKey ?? '',
      photo_key: u.photoKey ?? '',
      ministry_status: u.ministryStatus,
      ministry_basis: u.ministryBasis ?? '',
      ranking_qs: intText(u.rankingQs),
      ranking_the: intText(u.rankingThe),
      ranking_arwu: intText(u.rankingArwu),
      ranking_moscow: intText(u.rankingMoscow),
      source_url: u.sourceUrl ?? '',
      last_checked: u.lastChecked,
      published: u.published,
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
            name: 'country_code',
            label: 'admin.field.country',
            options: await countryOptions(db, lang),
            blank: 'admin.choose',
            required: true,
          },
          { kind: 'text', name: 'city', label: 'admin.field.city', required: true },
          {
            kind: 'select',
            name: 'type',
            label: 'admin.field.universityType',
            options: UNIVERSITY_TYPES.map((v) => ({
              value: v,
              label: t(`admin.universityType.${v}`),
            })),
            blank: 'admin.unknown',
          },
          { kind: 'url', name: 'website', label: 'admin.field.website' },
          { kind: 'image', name: 'logo_key', label: 'admin.field.logo', image: 'logo' },
          { kind: 'image', name: 'photo_key', label: 'admin.field.photo', image: 'photo' },
        ],
      },
      {
        legend: 'admin.section.ministry',
        fields: [
          {
            kind: 'select',
            name: 'ministry_status',
            label: 'admin.field.ministryStatus',
            options: MINISTRY_STATUSES.map((v) => ({ value: v, label: t(`ministry.${v}`) })),
            required: true,
          },
          {
            kind: 'text',
            name: 'ministry_basis',
            label: 'admin.field.ministryBasis',
            hint: 'admin.hint.ministryBasis',
          },
          ...RANKINGS.map(([name, label]) => ({
            kind: 'number' as const,
            name,
            label,
            min: 1,
            step: '1',
          })),
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
    const name: Translated = translated(form, 'name');
    const v = {
      slug: text(form, 'slug') || slugify(name.en),
      country_code: text(form, 'country_code').toUpperCase(),
      city: text(form, 'city'),
      type: text(form, 'type'),
      website: text(form, 'website'),
      logo_key: text(form, 'logo_key'),
      photo_key: text(form, 'photo_key'),
      ministry_status: text(form, 'ministry_status'),
      ministry_basis: text(form, 'ministry_basis'),
      source_url: text(form, 'source_url'),
      last_checked: lastCheckedOnSave(form, today),
      published: flag(form, 'published'),
    };
    const rankingText = Object.fromEntries(RANKINGS.map(([n]) => [n, text(form, n)]));
    const values: FormValues = { name, ...v, ...rankingText };
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
    if (!/^[A-Z]{2}$/.test(v.country_code))
      errors['country_code'] = { key: 'admin.error.required' };
    if (!v.city) errors['city'] = { key: 'admin.error.required' };
    if (v.type && !(UNIVERSITY_TYPES as readonly string[]).includes(v.type)) {
      errors['type'] = { key: 'admin.error.choice' };
    }
    if (v.website && !isHttpUrl(v.website)) errors['website'] = { key: 'admin.error.url' };
    for (const key of ['logo_key', 'photo_key'] as const) {
      if (v[key] && !PUBLIC_IMAGE_KEY.test(v[key])) errors[key] = { key: 'admin.error.image' };
    }
    if (!(MINISTRY_STATUSES as readonly string[]).includes(v.ministry_status)) {
      errors['ministry_status'] = { key: 'admin.error.choice' };
    }
    const rankings: Record<string, number | null> = {};
    for (const [n] of RANKINGS) {
      const value = optionalInt(rankingText[n] ?? '', 1, 100_000);
      if (value === undefined) errors[n] = { key: 'admin.error.number' };
      else rankings[n] = value;
    }
    if (v.ministry_status === 'approved' && !v.ministry_basis) {
      errors['ministry_basis'] = { key: 'admin.error.basisNeeded' };
    }

    return {
      values,
      errors,
      async save(db, adminId, id, before) {
        const recordId = id ?? (await nextId(db, universities));
        const row = {
          slug: v.slug,
          name: name.en,
          countryCode: v.country_code,
          city: v.city,
          type: (v.type || null) as (typeof UNIVERSITY_TYPES)[number] | null,
          website: v.website || null,
          logoKey: v.logo_key || null,
          photoKey: v.photo_key || null,
          ministryStatus: v.ministry_status as (typeof MINISTRY_STATUSES)[number],
          ministryBasis: v.ministry_basis || null,
          rankingQs: rankings['ranking_qs'] ?? null,
          rankingThe: rankings['ranking_the'] ?? null,
          rankingArwu: rankings['ranking_arwu'] ?? null,
          rankingMoscow: rankings['ranking_moscow'] ?? null,
          sourceUrl: v.source_url || null,
          lastChecked: v.last_checked,
          published: v.published,
        };
        try {
          await runBatch(db, [
            id === null
              ? db.insert(universities).values({ id: recordId, ...row })
              : db.update(universities).set(row).where(eq(universities.id, id)),
            ...textStatements(db, 'university', recordId, 'name', name),
            auditInsert(db, {
              adminId,
              action: id === null ? 'create' : 'update',
              entityType: 'university',
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
          .where(and(eq(savedItems.itemType, 'university'), eq(savedItems.itemId, id))),
        deleteTexts(db, 'university', id),
        db.delete(universities).where(eq(universities.id, id)),
        auditInsert(db, { adminId, action: 'delete', entityType: 'university', entityId: id }),
      ]);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: removeError(error) };
    }
  },

  publicPath(values, lang) {
    return values['published'] === true ? `/${lang}/universities/${String(values['slug'])}` : null;
  },
};
