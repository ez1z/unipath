/**
 * Reference data the site needs before any record: countries (with names in
 * three languages and their place in "Popular countries") and the six
 * discussion boards (SPEC). Real facts, no demo records, so it is loaded into
 * production too (`pnpm db:reference --sql`, DEPLOY.md). The demo seed uses
 * the same lists.
 *
 * Which countries come first is Eziz's call (SPEC open questions): add a
 * country here before importing or adding its universities.
 */
import type { Lang } from '../i18n/config.ts';
import { sqlValue } from './backup.ts';
import { TOPIC_SLUGS } from './db/values.ts';

type TopicSlug = (typeof TOPIC_SLUGS)[number];

export type Names = Record<Lang, string>;

export interface Country {
  /** ISO 3166-1 alpha-2. */
  code: string;
  /** Lower is more popular; null = not in the Popular countries list. */
  popularRank: number | null;
  name: Names;
}

export const COUNTRIES: Country[] = [
  { code: 'TR', popularRank: 1, name: { tk: 'Türkiýe', ru: 'Турция', en: 'Türkiye' } },
  { code: 'RU', popularRank: 2, name: { tk: 'Russiýa', ru: 'Россия', en: 'Russia' } },
  { code: 'HU', popularRank: 3, name: { tk: 'Wengriýa', ru: 'Венгрия', en: 'Hungary' } },
  {
    code: 'GB',
    popularRank: 4,
    name: { tk: 'Beýik Britaniýa', ru: 'Великобритания', en: 'United Kingdom' },
  },
];

export const TOPIC_NAMES: Record<TopicSlug, Names> = {
  'choosing-a-country': { tk: 'Ýurt saýlamak', ru: 'Выбор страны', en: 'Choosing a country' },
  scholarships: { tk: 'Stipendiýalar', ru: 'Стипендии', en: 'Scholarships' },
  'documents-and-visas': {
    tk: 'Resminamalar we wizalar',
    ru: 'Документы и визы',
    en: 'Documents and visas',
  },
  tests: { tk: 'Synaglar (IELTS, SAT)', ru: 'Экзамены (IELTS, SAT)', en: 'Tests (IELTS, SAT)' },
  'life-abroad': { tk: 'Daşary ýurtda durmuş', ru: 'Жизнь за рубежом', en: 'Life abroad' },
  'for-parents': { tk: 'Ene-atalar üçin', ru: 'Для родителей', en: 'For parents' },
};

/**
 * Upserts for countries, topics and their names: safe to run again, and they
 * never delete anything (a country already used by records keeps working).
 */
export function referenceStatements(): string[] {
  const name = (type: 'country' | 'topic', id: string, names: Names) =>
    (Object.entries(names) as [Lang, string][]).map(
      ([lang, text]) =>
        `INSERT INTO translations (entity_type, entity_id, lang, field, text) VALUES (${sqlValue(type)}, ${sqlValue(id)}, ${sqlValue(lang)}, 'name', ${sqlValue(text)}) ON CONFLICT (entity_type, entity_id, lang, field) DO UPDATE SET text = excluded.text;`,
    );
  return [
    ...COUNTRIES.flatMap((c) => [
      `INSERT INTO countries (code, popular_rank) VALUES (${sqlValue(c.code)}, ${sqlValue(c.popularRank)}) ON CONFLICT (code) DO UPDATE SET popular_rank = excluded.popular_rank;`,
      ...name('country', c.code, c.name),
    ]),
    ...TOPIC_SLUGS.flatMap((slug, i) => [
      `INSERT INTO topics (slug, sort) VALUES (${sqlValue(slug)}, ${i + 1}) ON CONFLICT (slug) DO UPDATE SET sort = excluded.sort;`,
      ...name('topic', slug, TOPIC_NAMES[slug]),
    ]),
  ];
}
