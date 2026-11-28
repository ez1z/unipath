/**
 * The Ministry's approved list (SPEC: CSV of university name, country,
 * ranking source, position) matched to Clavis universities.
 *
 * A row matches when exactly one university in that country has the same
 * name, compared without case, accents or punctuation, in English, Turkmen
 * or Russian. Unmatched, ambiguous and unreadable rows go to a review list;
 * nothing is guessed. A match sets the university to "approved", with the
 * list's ranking and position as the basis.
 */
import { sqlValue } from '../backup.ts';

export type RankingColumn = 'ranking_qs' | 'ranking_the' | 'ranking_arwu' | 'ranking_moscow';

export interface MoeRow {
  line: number;
  name: string;
  country: string;
  source: string;
  position: string;
}

export interface UniversityName {
  id: number;
  slug: string;
  countryCode: string;
  /** English name and its translations. */
  names: string[];
  ministryStatus: string;
  ministryBasis: string | null;
}

export interface MoeMatch {
  row: MoeRow;
  university: UniversityName;
  column: RankingColumn;
  position: number;
  basis: string;
  /** False when the university is already approved with this exact basis. */
  changes: boolean;
}

export interface MoeReview {
  row: MoeRow;
  reason: 'no_match' | 'ambiguous' | 'unknown_country' | 'unknown_source' | 'bad_position';
  candidates: string[];
}

/** RFC 4180-ish CSV: commas, double-quoted fields with "" escapes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  // A byte-order mark (U+FEFF) from Excel is not part of the first name.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Rows of the list; a first row of column names is skipped. */
export function readMoeCsv(text: string): MoeRow[] {
  const rows = parseCsv(text);
  const first = rows[0]?.map((c) => c.trim().toLowerCase()) ?? [];
  const hasHeader = first.includes('country') || first.some((c) => c.includes('name'));
  return rows.slice(hasHeader ? 1 : 0).map((cells, i) => ({
    line: i + (hasHeader ? 2 : 1),
    name: (cells[0] ?? '').trim(),
    country: (cells[1] ?? '').trim(),
    source: (cells[2] ?? '').trim(),
    position: (cells[3] ?? '').trim(),
  }));
}

/** "Universität Wien" and "universitat-wien" compare equal. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function rankingColumn(source: string): RankingColumn | null {
  const s = normalizeName(source);
  if (/^qs\b/.test(s) || s.includes('quacquarelli')) return 'ranking_qs';
  if (/^the\b/.test(s) || s.includes('times higher')) return 'ranking_the';
  if (/^arwu\b/.test(s) || s.includes('shanghai') || s.includes('academic ranking')) {
    return 'ranking_arwu';
  }
  if (s.includes('moscow') || s.includes('mosiur') || s.includes('три миссии')) {
    return 'ranking_moscow';
  }
  return null;
}

const COLUMN_LABEL: Record<RankingColumn, string> = {
  ranking_qs: 'QS',
  ranking_the: 'THE',
  ranking_arwu: 'ARWU',
  ranking_moscow: 'Moscow International',
};

export function matchMoeList(
  rows: MoeRow[],
  universities: UniversityName[],
  /** Country code by code or by any of its names. */
  countryOf: (value: string) => string | null,
): { matches: MoeMatch[]; review: MoeReview[] } {
  const matches: MoeMatch[] = [];
  const review: MoeReview[] = [];
  for (const row of rows) {
    const code = countryOf(row.country);
    if (!code) {
      review.push({ row, reason: 'unknown_country', candidates: [] });
      continue;
    }
    const column = rankingColumn(row.source);
    if (!column) {
      review.push({ row, reason: 'unknown_source', candidates: [] });
      continue;
    }
    const position = Number(row.position.replace(/^[=#]/, '').split(/[-–]/)[0]);
    if (!Number.isInteger(position) || position < 1) {
      review.push({ row, reason: 'bad_position', candidates: [] });
      continue;
    }
    const wanted = normalizeName(row.name);
    const inCountry = universities.filter((u) => u.countryCode === code);
    const found = inCountry.filter((u) => u.names.some((n) => normalizeName(n) === wanted));
    if (found.length !== 1) {
      // Suggest names sharing a word, to help the reviewer.
      const words = new Set(wanted.split(' ').filter((w) => w.length > 3));
      const near = (found.length > 1 ? found : inCountry)
        .filter(
          (u) =>
            found.length > 1 ||
            u.names.some((n) =>
              normalizeName(n)
                .split(' ')
                .some((w) => words.has(w)),
            ),
        )
        .slice(0, 5)
        .map((u) => u.slug);
      review.push({ row, reason: found.length > 1 ? 'ambiguous' : 'no_match', candidates: near });
      continue;
    }
    const university = found[0] as UniversityName;
    const basis = `${COLUMN_LABEL[column]} ${position}`;
    matches.push({
      row,
      university,
      column,
      position,
      basis,
      changes: !(university.ministryStatus === 'approved' && university.ministryBasis === basis),
    });
  }
  return { matches, review };
}

/** UPDATE statements, by slug, with an audit row each. */
export function moeStatements(matches: MoeMatch[], { file }: { file: string }): string[] {
  return matches
    .filter((m) => m.changes)
    .flatMap((m) => [
      `UPDATE universities SET ministry_status = 'approved', ministry_basis = ${sqlValue(m.basis)}, ${m.column} = ${m.position} WHERE slug = ${sqlValue(m.university.slug)};`,
      `INSERT INTO audit_log (admin_id, action, entity_type, entity_id, diff) VALUES (NULL, 'import', 'university', (SELECT CAST(id AS TEXT) FROM universities WHERE slug = ${sqlValue(m.university.slug)}), ${sqlValue(
        JSON.stringify({
          file,
          line: m.row.line,
          ministry_status: [m.university.ministryStatus, 'approved'],
          ministry_basis: [m.university.ministryBasis, m.basis],
        }),
      )});`,
    ]);
}

const csvCell = (value: string) =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** The review list as CSV: the original columns plus why and close names. */
export function reviewCsv(review: MoeReview[]): string {
  const head = ['line', 'name', 'country', 'ranking_source', 'position', 'reason', 'candidates'];
  const rows = review.map((r) => [
    String(r.row.line),
    r.row.name,
    r.row.country,
    r.row.source,
    r.row.position,
    r.reason,
    r.candidates.join(' '),
  ]);
  return `${[head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')}\n`;
}

/** Universities with every name they have, from the local D1. */
export async function loadUniversityNames(d1: D1Database): Promise<UniversityName[]> {
  const { results } = await d1
    .prepare(
      `SELECT u.id, u.slug, u.country_code, u.name, u.ministry_status, u.ministry_basis,
              (SELECT json_group_array(t.text) FROM translations t
               WHERE t.entity_type = 'university' AND t.entity_id = CAST(u.id AS TEXT) AND t.field = 'name') AS other
       FROM universities u`,
    )
    .all<{
      id: number;
      slug: string;
      country_code: string;
      name: string;
      ministry_status: string;
      ministry_basis: string | null;
      other: string | null;
    }>();
  return results.map((r) => ({
    id: r.id,
    slug: r.slug,
    countryCode: r.country_code,
    names: [
      r.name,
      ...(JSON.parse(r.other ?? '[]') as unknown[]).filter(
        (n): n is string => typeof n === 'string',
      ),
    ],
    ministryStatus: r.ministry_status,
    ministryBasis: r.ministry_basis,
  }));
}

/** A lookup from country code or name (any language) to code. */
export async function loadCountryLookup(d1: D1Database): Promise<(value: string) => string | null> {
  const [codes, names] = await d1.batch<{ code: string; text?: string }>([
    d1.prepare('SELECT code FROM countries'),
    d1.prepare(
      `SELECT entity_id AS code, text FROM translations WHERE entity_type = 'country' AND field = 'name'`,
    ),
  ]);
  const byName = new Map<string, string>();
  for (const c of codes?.results ?? []) byName.set(c.code.toLowerCase(), c.code);
  for (const n of names?.results ?? []) if (n.text) byName.set(normalizeName(n.text), n.code);
  return (value) =>
    byName.get(value.trim().toLowerCase()) ?? byName.get(normalizeName(value)) ?? null;
}
