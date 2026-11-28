/**
 * Option lists for admin selects. Admin-only, so unpublished records are
 * included (marked), and names are English (the records' own column) except
 * countries, which are named in the admin's language.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Lang, Translate } from '../../i18n/index.ts';
import type { Db } from '../db/client.ts';
import { countries, pathwayColleges, programs, translations, universities } from '../db/schema.ts';
import { PRE_YEAR_LEVELS } from '../db/values.ts';
import type { Option } from './form.ts';

export async function countryOptions(db: Db, lang: Lang): Promise<Option[]> {
  const [codes, names] = await Promise.all([
    db.select({ code: countries.code }).from(countries).orderBy(asc(countries.code)),
    db
      .select({ code: translations.entityId, lang: translations.lang, text: translations.text })
      .from(translations)
      .where(
        and(
          eq(translations.entityType, 'country'),
          eq(translations.field, 'name'),
          inArray(translations.lang, [lang, 'en']),
        ),
      ),
  ]);
  const nameOf = new Map<string, string>();
  for (const n of names) if (n.lang === 'en' && !nameOf.has(n.code)) nameOf.set(n.code, n.text);
  for (const n of names) if (n.lang === lang) nameOf.set(n.code, n.text);
  return codes
    .map((c) => ({ value: c.code, label: `${nameOf.get(c.code) ?? c.code} (${c.code})` }))
    .sort((a, b) => a.label.localeCompare(b.label, lang));
}

const draft = (t: Translate, published: boolean) => (published ? '' : ` · ${t('admin.draft')}`);

/** Universities and colleges for a program's provider: `university:1`, `college:2`. */
export async function providerOptions(db: Db, t: Translate): Promise<Option[]> {
  const [unis, colleges] = await Promise.all([
    db
      .select({ id: universities.id, name: universities.name, published: universities.published })
      .from(universities)
      .orderBy(asc(universities.name)),
    db
      .select({
        id: pathwayColleges.id,
        name: pathwayColleges.name,
        published: pathwayColleges.published,
      })
      .from(pathwayColleges)
      .orderBy(asc(pathwayColleges.name)),
  ]);
  return [
    ...unis.map((u) => ({
      value: `university:${u.id}`,
      label: `${u.name}${draft(t, u.published)}`,
      group: t('admin.type.universities'),
    })),
    ...colleges.map((c) => ({
      value: `college:${c.id}`,
      label: `${c.name}${draft(t, c.published)}`,
      group: t('admin.type.colleges'),
    })),
  ];
}

export async function universityOptions(db: Db, t: Translate): Promise<Option[]> {
  const rows = await db
    .select({ id: universities.id, name: universities.name, published: universities.published })
    .from(universities)
    .orderBy(asc(universities.name));
  return rows.map((u) => ({ value: String(u.id), label: `${u.name}${draft(t, u.published)}` }));
}

/** Programs with their provider, for pathways and scholarships. */
export async function programOptions(
  db: Db,
  t: Translate,
  levels: 'pre' | 'bachelor',
): Promise<Option[]> {
  const rows = await db
    .select({
      id: programs.id,
      name: programs.name,
      level: programs.level,
      published: programs.published,
      university: universities.name,
      college: pathwayColleges.name,
    })
    .from(programs)
    .leftJoin(universities, eq(universities.id, programs.universityId))
    .leftJoin(pathwayColleges, eq(pathwayColleges.id, programs.collegeId))
    .where(
      levels === 'bachelor'
        ? eq(programs.level, 'bachelor')
        : inArray(programs.level, [...PRE_YEAR_LEVELS]),
    )
    .orderBy(asc(programs.name));
  return rows
    .map((p) => {
      const provider = p.university ?? p.college ?? '';
      return {
        value: String(p.id),
        label: `${p.name} · ${provider}${draft(t, p.published)}`,
        group: provider,
      };
    })
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
}
