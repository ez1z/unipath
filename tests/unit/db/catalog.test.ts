/**
 * M2 page queries against the demo seed (see scripts/seed-data.ts): university,
 * college, scholarship search, Compare, text search and "Report a mistake".
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  findReportTarget,
  getCollegePage,
  getComparePage,
  getCountries,
  getUniversityPage,
  searchScholarships,
} from '../../../src/lib/db/catalog.ts';
import { searchPrograms, searchUniversities } from '../../../src/lib/db/queries.ts';
import { submitReport } from '../../../src/lib/report.ts';
import {
  parseCompareIds,
  parseProgramFilters,
  parseScholarshipFilters,
  parseUniversityFilters,
} from '../../../src/lib/search/filters.ts';
import { translations, universities } from '../../../src/lib/db/schema.ts';
import { createTestDb, TODAY, type TestDb } from './test-db.ts';

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => {
  await t.dispose();
});

const opts = { lang: 'en', today: TODAY } as const;

describe('text search (FTS5)', () => {
  const programIds = async (q: string, lang: 'tk' | 'ru' | 'en' = 'en') =>
    (
      await searchPrograms(t.db, parseProgramFilters(new URLSearchParams({ q })), {
        lang,
        today: TODAY,
        pageSize: 100,
      })
    ).items.map((p) => p.id);

  test('finds programs by name, by word prefix, in any language', async () => {
    expect(await programIds('economics')).toContain(202);
    expect(await programIds('econ')).toContain(202);
    // Names are indexed in all three languages, whatever the page language.
    expect(await programIds('türk')).toContain(104);
    expect(await programIds('турецкого', 'en')).toContain(104);
  });

  test('finds programs by field, university and city', async () => {
    expect(await programIds('medicine')).toEqual(expect.arrayContaining([103, 502]));
    expect(await programIds('demo university 1')).toEqual(
      expect.arrayContaining([101, 102, 103, 104]),
    );
  });

  test('every word must match', async () => {
    const both = await programIds('business demo university 8');
    expect(both).toContain(801);
    expect(both).not.toContain(101);
  });

  test('FTS syntax typed by a visitor is plain text, never an error', async () => {
    for (const q of ['"', 'NEAR(a b)', 'a OR b', '*', 'col:econ', '(((', '-x']) {
      await expect(programIds(q)).resolves.toBeInstanceOf(Array);
    }
  });

  test('never returns drafts or programs of unpublished universities', async () => {
    expect(await programIds('draft')).not.toContain(105);
    expect(await programIds('pharmacy')).not.toContain(901);
  });

  test('universities by name', async () => {
    const page = await searchUniversities(
      t.db,
      parseUniversityFilters(new URLSearchParams({ q: 'demo university 2' })),
      opts,
    );
    expect(page.items.map((u) => u.id)).toContain(2);
  });
});

describe('getUniversityPage', () => {
  test('summary of costs, deadline and open scholarships', async () => {
    const page = await getUniversityPage(t.db, 'demo-university-1', opts);
    expect(page).not.toBeNull();
    if (!page) return;
    expect(page.bachelors.map((p) => p.id).sort()).toEqual([101, 102, 103]);
    expect(page.preYears.map((p) => p.id)).toContain(104);
    // Scholarship 1 covers the whole university and is open.
    expect(page.scholarships.map((s) => s.id)).toContain(1);
    expect(page.summary.openScholarships).toBeGreaterThanOrEqual(1);
    if (page.summary.tuitionMinUsd !== null && page.summary.tuitionMaxUsd !== null) {
      expect(page.summary.tuitionMinUsd).toBeLessThanOrEqual(page.summary.tuitionMaxUsd);
    }
  });

  test("lists college pre-years that lead into its bachelor's", async () => {
    // 1201 (Pathway College 2) leads to 601 at Demo University 6.
    const page = await getUniversityPage(t.db, 'demo-university-6', opts);
    expect(page?.preYears.map((p) => p.id)).toEqual(expect.arrayContaining([602, 1201]));
  });

  test('an unpublished university is not found', async () => {
    expect(await getUniversityPage(t.db, 'demo-university-9', opts)).toBeNull();
  });

  // Regression: names were only looked up through the programs, so a new
  // university (no programs yet) showed its English name on /tk and /ru.
  test('a university with no programs still gets its own translated name', async () => {
    await t.db.insert(universities).values({
      id: 9901,
      slug: 'no-programs-yet',
      name: 'No Programs Yet University',
      countryCode: 'TR',
      city: 'Ankara',
      lastChecked: TODAY,
      sourceUrl: 'https://example.org/no-programs',
      published: true,
    });
    await t.db.insert(translations).values([
      {
        entityType: 'university',
        entityId: '9901',
        lang: 'tk',
        field: 'name',
        text: 'Täze uniwersitet',
      },
    ]);
    const page = await getUniversityPage(t.db, 'no-programs-yet', { ...opts, lang: 'tk' });
    expect(page?.bachelors).toEqual([]);
    expect(page?.university.name).toEqual({ text: 'Täze uniwersitet', fallback: false });
    expect(page?.university.countryName.fallback).toBe(false);
  });
});

describe('getCollegePage', () => {
  test("programs and the bachelor's they lead to", async () => {
    const page = await getCollegePage(t.db, 'demo-pathway-college-1', opts);
    expect(page).not.toBeNull();
    expect(page?.programs.map((p) => p.id).sort()).toEqual([1101, 1102]);
  });
});

describe('searchScholarships', () => {
  const ids = async (query: string) =>
    (
      await searchScholarships(t.db, parseScholarshipFilters(new URLSearchParams(query)), opts)
    ).items.map((s) => s.id);

  test('soonest fixed deadline first, then rolling; closed and unpublished hidden', async () => {
    // 2 closes in 20 days, 1 in 45, 3 is rolling, 4 is closed, 5 is unpublished.
    expect(await ids('')).toEqual([2, 1, 3]);
  });

  test('"show closed" adds closed ones at the end', async () => {
    expect(await ids('closed=1')).toEqual([2, 1, 3, 4]);
  });

  test('filters by coverage and country', async () => {
    expect(await ids('coverage=full')).toEqual([2, 1]);
    expect(await ids('coverage=partial&closed=1')).toEqual([3, 4]);
    expect(await ids('country=TR')).toEqual([1]);
  });

  test('"covers the pre-year" and "open to Turkmen" keep confirmed ones only', async () => {
    // 3 doesn't cover the pre-year; 4 is "not confirmed" (and closed).
    expect(await ids('pre_year=1&closed=1')).toEqual([2, 1]);
    // 3 is "not confirmed" for Turkmen citizens, so it is hidden.
    expect(await ids('turkmen=1')).toEqual([2, 1]);
    expect(await ids('turkmen=1&closed=1')).toEqual([2, 1, 4]);
  });
});

describe('getComparePage', () => {
  const compare = (ids: string) =>
    getComparePage(t.db, parseCompareIds(new URLSearchParams({ ids })), opts);

  test("a direct-entry bachelor's: no pre-year, its own length", async () => {
    const { columns, missing } = await compare('101');
    expect(missing).toBe(0);
    expect(columns[0]?.preYear).toBeNull();
    expect(columns[0]?.totalYears).toBe(4);
  });

  test("a picked pre-year + bachelor's path", async () => {
    const { columns } = await compare('203-201');
    expect(columns[0]?.preYear?.id).toBe(203);
    expect(columns[0]?.totalYears).toBe(5);
    expect(columns[0]?.autoPreYear).toBe(false);
  });

  test("a bachelor's that requires a pre-year gets its shortest one", async () => {
    // 202 requires a pre-year; 104 → 202 is its only pathway (1 + 4).
    const { columns } = await compare('202');
    expect(columns[0]?.preYear?.id).toBe(104);
    expect(columns[0]?.totalYears).toBe(5);
    expect(columns[0]?.autoPreYear).toBe(true);
  });

  test("pairs that don't exist, pre-years alone and unpublished programs are missing", async () => {
    // 203 → 202 isn't a pathway; 203 alone isn't a bachelor's; 105 is a draft.
    const { columns, missing } = await compare('203-202,203,105');
    expect(columns).toEqual([]);
    expect(missing).toBe(3);
  });

  test('keeps the order of the URL', async () => {
    const { columns } = await compare('601,101');
    expect(columns.map((c) => c.bachelor.id)).toEqual([601, 101]);
  });
});

describe('getCountries', () => {
  test('popular countries first, then the rest by name', async () => {
    const list = await getCountries(t.db, 'en');
    const ranks = list.map((c) => c.popularRank);
    const firstUnranked = ranks.indexOf(null);
    const ranked = firstUnranked === -1 ? ranks : ranks.slice(0, firstUnranked);
    expect(ranked).toEqual([...ranked].sort((a, b) => (a ?? 0) - (b ?? 0)));
    if (firstUnranked !== -1)
      expect(ranks.slice(firstUnranked).every((r) => r === null)).toBe(true);
  });
});

describe('Report a mistake', () => {
  const allow = () => Promise.resolve(true);
  const deps = (allowed = allow) => ({ db: t.db, lang: 'en' as const, allow: allowed });
  const count = async () =>
    (await t.d1.prepare('select count(*) n from mistake_reports').first<{ n: number }>())?.n ?? 0;

  test('finds published records only', async () => {
    expect(await findReportTarget(t.db, 'en', 'program', 101)).not.toBeNull();
    expect(await findReportTarget(t.db, 'en', 'program', 105)).toBeNull();
    expect(await findReportTarget(t.db, 'en', 'scholarship', 5)).toBeNull();
    expect((await findReportTarget(t.db, 'en', 'university', 1))?.path).toBe(
      '/universities/demo-university-1',
    );
  });

  test('stores a valid report', async () => {
    const before = await count();
    const result = await submitReport(
      { type: 'program', id: '101', message: '  The deadline on the official page is later.  ' },
      deps(),
    );
    expect(result.ok).toBe(true);
    expect(await count()).toBe(before + 1);
  });

  test('rejects short, long, unknown and unpublished; stores nothing', async () => {
    const before = await count();
    const cases: [unknown, string][] = [
      [{ type: 'program', id: '101', message: 'too short' }, 'short'],
      [{ type: 'program', id: '101', message: 'x'.repeat(2001) }, 'long'],
      [{ type: 'program', id: '105', message: "A draft can't be reported." }, 'notFound'],
      [{ type: 'user', id: '1', message: 'Not a public record type.' }, 'invalid'],
      [{ type: 'program', id: '-1', message: 'Not a valid id at all.' }, 'invalid'],
      [null, 'invalid'],
    ];
    for (const [input, error] of cases) {
      const result = await submitReport(input, deps());
      expect(result, JSON.stringify(input)).toMatchObject({ ok: false, error });
    }
    expect(await count()).toBe(before);
  });

  test('the honeypot looks like success and stores nothing', async () => {
    const before = await count();
    const result = await submitReport(
      { type: 'program', id: '101', message: 'Buy cheap things here!!', website: 'spam.example' },
      deps(),
    );
    expect(result.ok).toBe(true);
    expect(await count()).toBe(before);
  });

  test('over the rate limit: refused, nothing stored', async () => {
    const before = await count();
    const result = await submitReport(
      { type: 'program', id: '101', message: 'A real report, but too many of them.' },
      deps(() => Promise.resolve(false)),
    );
    expect(result).toMatchObject({ ok: false, error: 'rate' });
    expect(await count()).toBe(before);
  });
});
