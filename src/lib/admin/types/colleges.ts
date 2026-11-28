/** Pathway colleges in /admin. Their partner universities come through pathways. */
import { and, asc, eq, like, lt, or, type SQL } from 'drizzle-orm';
import { pathwayColleges } from '../../db/schema.ts';
import { auditInsert, diffOf } from '../audit.ts';
import { countryOptions } from '../choices.ts';
import {
  checkPublicRecord,
  flag,
  isHttpUrl,
  isStale,
  lastCheckedOnSave,
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

export const collegesAdmin: RecordType = {
  type: 'colleges',
  pluralKey: 'admin.type.colleges',
  singularKey: 'admin.one.colleges',
  filters: ['q', 'country', 'published', 'stale'],
  searchable: true,

  async list(db, _lang, f, today) {
    const where: SQL[] = [];
    if (f.q) {
      const q = `%${f.q}%`;
      const match = or(like(pathwayColleges.name, q), like(pathwayColleges.slug, q));
      if (match) where.push(match);
    }
    if (f.country) where.push(eq(pathwayColleges.countryCode, f.country));
    if (f.published) where.push(eq(pathwayColleges.published, f.published === 'yes'));
    if (f.stale) where.push(lt(pathwayColleges.lastChecked, staleBefore(today)));
    const rows = await db
      .select()
      .from(pathwayColleges)
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(pathwayColleges.name))
      .limit(LIST_PAGE_SIZE + 1)
      .offset((f.page - 1) * LIST_PAGE_SIZE);
    return {
      more: rows.length > LIST_PAGE_SIZE,
      rows: rows.slice(0, LIST_PAGE_SIZE).map((c) => ({
        id: c.id,
        title: c.name,
        details: `${c.countryCode} · ${c.city}`,
        published: c.published,
        lastChecked: c.lastChecked,
        stale: isStale(c.lastChecked, today),
        publicPath: c.published ? `/colleges/${c.slug}` : null,
      })),
    };
  },

  empty(today) {
    return {
      name: { en: '', tk: '', ru: '' },
      slug: '',
      country_code: '',
      city: '',
      website: '',
      source_url: '',
      last_checked: today,
      published: false,
    };
  },

  async load(db, id) {
    const [c] = await db.select().from(pathwayColleges).where(eq(pathwayColleges.id, id)).limit(1);
    if (!c) return null;
    const texts = await readTexts(db, 'college', id, ['name']);
    return {
      name: { en: c.name, ...(texts['name'] ?? { tk: '', ru: '' }) },
      slug: c.slug,
      country_code: c.countryCode,
      city: c.city,
      website: c.website ?? '',
      source_url: c.sourceUrl ?? '',
      last_checked: c.lastChecked,
      published: c.published,
    };
  },

  async sections(db, lang) {
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
          { kind: 'url', name: 'website', label: 'admin.field.website' },
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
    const v = {
      slug: text(form, 'slug') || slugify(name.en),
      country_code: text(form, 'country_code').toUpperCase(),
      city: text(form, 'city'),
      website: text(form, 'website'),
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
    if (!/^[A-Z]{2}$/.test(v.country_code))
      errors['country_code'] = { key: 'admin.error.required' };
    if (!v.city) errors['city'] = { key: 'admin.error.required' };
    if (v.website && !isHttpUrl(v.website)) errors['website'] = { key: 'admin.error.url' };

    return {
      values,
      errors,
      async save(db, adminId, id, before) {
        const recordId = id ?? (await nextId(db, pathwayColleges));
        const row = {
          slug: v.slug,
          name: name.en,
          countryCode: v.country_code,
          city: v.city,
          website: v.website || null,
          sourceUrl: v.source_url || null,
          lastChecked: v.last_checked,
          published: v.published,
        };
        try {
          await runBatch(db, [
            id === null
              ? db.insert(pathwayColleges).values({ id: recordId, ...row })
              : db.update(pathwayColleges).set(row).where(eq(pathwayColleges.id, id)),
            ...textStatements(db, 'college', recordId, 'name', name),
            auditInsert(db, {
              adminId,
              action: id === null ? 'create' : 'update',
              entityType: 'college',
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
        deleteTexts(db, 'college', id),
        db.delete(pathwayColleges).where(eq(pathwayColleges.id, id)),
        auditInsert(db, { adminId, action: 'delete', entityType: 'college', entityId: id }),
      ]);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: removeError(error) };
    }
  },

  publicPath(values, lang) {
    return values['published'] === true ? `/${lang}/colleges/${String(values['slug'])}` : null;
  },
};
