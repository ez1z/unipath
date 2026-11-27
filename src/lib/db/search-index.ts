/**
 * Builds the full-text index behind the SearchBox (migrations/0002_search.sql).
 * Each program's row holds its names in every language, its provider's names,
 * city and country, and its field and level labels in tk, ru and en, so any of
 * those words finds it. Runs from the seed now and after admin saves (M7);
 * never on a public request.
 */
import { sql } from 'drizzle-orm';
import en from '../../i18n/en.json' with { type: 'json' };
import ru from '../../i18n/ru.json' with { type: 'json' };
import tk from '../../i18n/tk.json' with { type: 'json' };
import type { Db } from './client.ts';
import { pathwayColleges, programs, translations, universities } from './schema.ts';

type MessageFile = Record<string, string>;
const FILES: MessageFile[] = [tk, ru, en];

/** A UI label in all three languages, e.g. every word for "computing". */
function labels(key: string): string[] {
  return FILES.map((file) => file[key]).filter((text): text is string => text !== undefined);
}

/** At most 100 bound parameters per D1 statement; two per row. */
const ROWS_PER_INSERT = 50;

export interface SearchIndexCounts {
  programs: number;
  universities: number;
}

/** Search text for each record: base name plus every `name` translation, de-duplicated. */
function joinWords(parts: (string | null | undefined)[]): string {
  return [...new Set(parts.filter((p): p is string => !!p && p.trim() !== ''))].join(' \n');
}

export async function rebuildSearchIndex(db: Db): Promise<SearchIndexCounts> {
  const [programRows, universityRows, collegeRows, names] = await Promise.all([
    db
      .select({
        id: programs.id,
        name: programs.name,
        level: programs.level,
        field: programs.field,
        universityId: programs.universityId,
        collegeId: programs.collegeId,
      })
      .from(programs),
    db
      .select({
        id: universities.id,
        name: universities.name,
        city: universities.city,
        countryCode: universities.countryCode,
      })
      .from(universities),
    db
      .select({
        id: pathwayColleges.id,
        name: pathwayColleges.name,
        city: pathwayColleges.city,
        countryCode: pathwayColleges.countryCode,
      })
      .from(pathwayColleges),
    db
      .select({
        entityType: translations.entityType,
        entityId: translations.entityId,
        text: translations.text,
      })
      .from(translations)
      .where(sql`${translations.field} = 'name'`),
  ]);

  const translated = new Map<string, string[]>();
  for (const row of names) {
    const key = `${row.entityType}:${row.entityId}`;
    translated.set(key, [...(translated.get(key) ?? []), row.text]);
  }
  const namesOf = (type: string, id: string | number, base: string) => [
    base,
    ...(translated.get(`${type}:${id}`) ?? []),
  ];
  const placeOf = (place: { name: string; city: string; countryCode: string }) => [
    place.city,
    place.countryCode,
    ...namesOf('country', place.countryCode, place.countryCode),
  ];

  const unis = new Map(universityRows.map((u) => [u.id, u]));
  const colleges = new Map(collegeRows.map((c) => [c.id, c]));

  const universityBodies = universityRows.map((u) => ({
    id: u.id,
    body: joinWords([...namesOf('university', u.id, u.name), ...placeOf(u)]),
  }));

  const programBodies = programRows.map((p) => {
    const uni = p.universityId === null ? undefined : unis.get(p.universityId);
    const college = p.collegeId === null ? undefined : colleges.get(p.collegeId);
    const provider = uni
      ? [...namesOf('university', uni.id, uni.name), ...placeOf(uni)]
      : college
        ? [...namesOf('college', college.id, college.name), ...placeOf(college)]
        : [];
    return {
      id: p.id,
      body: joinWords([
        ...namesOf('program', p.id, p.name),
        ...(p.field ? labels(`field.${p.field}`) : []),
        ...labels(`level.${p.level}`),
        ...provider,
      ]),
    };
  });

  // The FTS tables aren't in the Drizzle schema, so this writes through D1 directly,
  // as one batch (one transaction): the index is never half rebuilt.
  const d1 = db.$client;
  const inserts = (
    table: 'program_search' | 'university_search',
    rows: { id: number; body: string }[],
  ) => {
    const statements: D1PreparedStatement[] = [];
    for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
      const chunk = rows.slice(i, i + ROWS_PER_INSERT);
      statements.push(
        d1
          .prepare(
            `insert into ${table} (rowid, body) values ${chunk.map(() => '(?, ?)').join(', ')}`,
          )
          .bind(...chunk.flatMap((r) => [r.id, r.body])),
      );
    }
    return statements;
  };

  await d1.batch([
    d1.prepare('delete from program_search'),
    d1.prepare('delete from university_search'),
    ...inserts('program_search', programBodies),
    ...inserts('university_search', universityBodies),
  ]);

  return { programs: programBodies.length, universities: universityBodies.length };
}

/**
 * The SearchBox text as an FTS5 query: each word becomes a quoted prefix term,
 * all of them required. Quoting means FTS5 syntax typed by a visitor is just text.
 * Null when there is nothing searchable.
 */
export function toFtsQuery(q: string | null): string | null {
  if (!q) return null;
  const words =
    q
      .normalize('NFKC')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = [...new Set(words)].slice(0, 6).map((word) => `"${word}"*`);
  return terms.length === 0 ? null : terms.join(' ');
}
