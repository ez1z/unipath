import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  findMatches,
  matchQueryFromQuiz,
  parseMatchQuery,
  searchQueryFor,
  serializeMatchQuery,
} from '../../../src/lib/matches.ts';
import { createTestDb, TODAY, type TestDb } from './test-db.ts';

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => {
  await t.dispose();
});

const opts = { lang: 'en', today: TODAY } as const;
const ids = async (query: string) =>
  (await findMatches(t.db, parseMatchQuery(new URLSearchParams(query)), opts)).items.map(
    (p) => p.id,
  );

describe('Matches for you', () => {
  test("bachelor's programs only, in the chosen countries and field", async () => {
    const { items } = await findMatches(
      t.db,
      parseMatchQuery(new URLSearchParams('country=TR&field=business')),
      opts,
    );
    expect(items.length).toBeGreaterThan(0);
    for (const p of items) {
      expect(p.level).toBe('bachelor');
      expect(p.provider.countryCode).toBe('TR');
      expect(p.field).toBe('business');
    }
  });

  test('the budget keeps only confirmed costs within it', async () => {
    const { items } = await findMatches(
      t.db,
      parseMatchQuery(new URLSearchParams('max_tuition=6500')),
      opts,
    );
    expect(items.length).toBeGreaterThan(0);
    for (const p of items) {
      expect(p.tuitionPerYearUsd).not.toBeNull();
      expect(p.tuitionPerYearUsd ?? Infinity).toBeLessThanOrEqual(6500);
    }
  });

  test('an IELTS score hides programs asking for more; no requirement still matches', async () => {
    // 102 asks for IELTS 6.5; 103 (Medicine) has no IELTS requirement.
    expect(await ids('country=TR&ielts=6')).not.toContain(102);
    expect(await ids('country=TR&ielts=7')).toContain(102);
    expect(await ids('country=TR&ielts=4')).toContain(103);
  });

  test('canonical query: search parameter names, a fixed order, bad values dropped', () => {
    const a = parseMatchQuery(new URLSearchParams('ielts=6.5&field=law&country=GB&country=TR'));
    const b = parseMatchQuery(new URLSearchParams('country=TR&country=GB&field=law&ielts=6.5&x=1'));
    expect(serializeMatchQuery(a).toString()).toBe(serializeMatchQuery(b).toString());
    expect(parseMatchQuery(new URLSearchParams('ielts=6.3')).ielts).toBeNull();
    expect(parseMatchQuery(new URLSearchParams('ielts=12')).ielts).toBeNull();
    expect(searchQueryFor(a).get('level')).toBe('bachelor');
    expect(searchQueryFor(a).has('ielts')).toBe(false);
  });

  test('from saved answers: only IELTS narrows; unknown fields are ignored', () => {
    expect(
      matchQueryFromQuiz({
        countries: ['TR'],
        field: 'magic',
        budgetPerYearUsd: 10_000,
        englishTest: { name: 'TOEFL', score: '90' },
      }),
    ).toEqual({ countries: ['TR'], field: null, maxTuitionUsd: 10_000, ielts: null });
    expect(
      matchQueryFromQuiz({
        countries: [],
        field: 'law',
        budgetPerYearUsd: null,
        englishTest: { name: 'IELTS', score: '6.5' },
      }).ielts,
    ).toBe(6.5);
  });
});
