/**
 * "Every search query must use an index; no full-table scans on public pages."
 * Reads SQLite's plan for each public query and fails on a plain `SCAN <table>`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  programSearchQuery,
  translationsQuery,
  universitySearchQuery,
} from '../../../src/lib/db/queries.ts';
import { parseProgramFilters, parseUniversityFilters } from '../../../src/lib/search/filters.ts';
import { createTestDb, TODAY, type TestDb } from './test-db.ts';

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => {
  await t.dispose();
});

async function fullScans(query: {
  toSQL(): { sql: string; params: unknown[] };
}): Promise<string[]> {
  const { sql, params } = query.toSQL();
  const plan = await t.d1
    .prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .bind(...params)
    .all<{ detail: string }>();
  expect(plan.results.length).toBeGreaterThan(0);
  // "SCAN programs" is a full scan. Not scans of a table: "SEARCH … USING INDEX",
  // "SCAN … USING COVERING INDEX", "SCAN (subquery-n)" (the count window) and
  // "SCAN json_each VIRTUAL TABLE" (walking the one bound list of ids).
  return plan.results
    .map((row) => row.detail)
    .filter(
      (detail) =>
        /^SCAN (?!\(subquery)/.test(detail) &&
        !detail.includes('USING') &&
        !detail.startsWith('SCAN json_each VIRTUAL TABLE'),
    );
}

const PROGRAM_QUERIES = [
  '',
  'level=bachelor',
  'country=GB',
  'field=computing&language=en',
  'min_tuition=1000&max_tuition=9000&sort=tuition',
  'length=3&length=5%2B',
  'total=4-or-less',
  'total=needs-pre-year&level=foundation',
  'total=direct-entry',
  'approved=1&sort=ranking',
  'scholarships=1&sort=deadline',
  'country=TR&country=RU&level=bachelor&level=language&field=business&length=4&total=4-or-less&approved=1&scholarships=1&page=2',
];

describe('query plans use indexes', () => {
  test.each(PROGRAM_QUERIES)('program search ?%s', async (query) => {
    const filters = parseProgramFilters(new URLSearchParams(query));
    expect(await fullScans(programSearchQuery(t.db, filters, TODAY))).toEqual([]);
  });

  test.each(['', 'status=approved', 'country=HU', 'foundation=1', 'scholarships=1&country=GB'])(
    'university search ?%s',
    async (query) => {
      const filters = parseUniversityFilters(new URLSearchParams(query));
      expect(await fullScans(universitySearchQuery(t.db, filters, TODAY))).toEqual([]);
    },
  );

  test('translations lookup', async () => {
    const query = translationsQuery(
      t.db,
      'ru',
      { program: [101, 102], university: [1], college: [1], country: ['TR', 'GB'] },
      ['name', 'amount_text'],
    );
    expect(query).not.toBeNull();
    if (query) expect(await fullScans(query)).toEqual([]);
  });
});
