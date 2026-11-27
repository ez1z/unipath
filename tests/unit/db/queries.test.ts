/**
 * Query helpers against the demo seed (see the shape notes in scripts/seed-data.ts).
 * Program ids: 1xx–9xx are at Demo University N, 11xx/12xx at Demo Pathway College 1/2.
 */
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  getProgramWithPathways,
  getScholarshipWithPrograms,
  searchPrograms,
  searchUniversities,
  type SearchPage,
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

const ALL_VISIBLE = [
  101, 102, 103, 104, 201, 202, 203, 301, 401, 402, 403, 501, 502, 601, 602, 701, 702, 801, 802,
  1101, 1102, 1201,
];

const programs = (query: string, lang: 'tk' | 'ru' | 'en' = 'en', pageSize = 100) =>
  searchPrograms(t.db, parseProgramFilters(new URLSearchParams(query)), {
    lang,
    today: TODAY,
    pageSize,
  });
const universities = (query: string, lang: 'tk' | 'ru' | 'en' = 'en') =>
  searchUniversities(t.db, parseUniversityFilters(new URLSearchParams(query)), {
    lang,
    today: TODAY,
  });

const ids = (page: SearchPage<{ id: number }>) => page.items.map((i) => i.id);
const sortedIds = (page: SearchPage<{ id: number }>) => ids(page).sort((a, b) => a - b);

describe('searchPrograms', () => {
  test('with no filters: every published level and field, nothing unpublished', async () => {
    const page = await programs('');
    expect(sortedIds(page)).toEqual(ALL_VISIBLE);
    expect(page.total).toBe(22);
    // 105 is a draft; 901 belongs to an unpublished university.
    expect(ids(page)).not.toContain(105);
    expect(ids(page)).not.toContain(901);
  });

  test.each([
    ['level=language', [104, 501, 1201]],
    ['level=foundation', [203, 401, 602, 802, 1101, 1102]],
    ['level=foundation&level=language', [104, 203, 401, 501, 602, 802, 1101, 1102, 1201]],
    ['country=GB', [701, 702, 801, 802, 1101, 1102]],
    ['country=HU', [601, 602, 1201]],
    ['country=GB&level=foundation', [802, 1101, 1102]],
    ['field=computing', [102, 403, 601]],
    ['language=ru', [401, 402, 403, 501, 502]],
    ['max_tuition=3000', [104, 202, 203, 401, 501, 1201]],
    ['min_tuition=25000', [701, 702, 801]],
    [
      'min_tuition=4000&max_tuition=6000',
      [101, 301, 403, 402, 502, 601, 602].sort((a, b) => a - b),
    ],
  ])('%s', async (query, expected) => {
    expect(sortedIds(await programs(query))).toEqual(expected);
  });

  test('a cost filter leaves out programs whose cost is not confirmed', async () => {
    expect(ids(await programs('min_tuition=0'))).not.toContain(103);
  });

  describe('bachelor’s length', () => {
    test('3 years: bachelor’s under 4 years, and pre-years that lead to one', async () => {
      expect(sortedIds(await programs('length=3'))).toEqual([
        601, 602, 701, 702, 801, 802, 1101, 1102, 1201,
      ]);
    });

    test('5+ years', async () => {
      expect(sortedIds(await programs('length=5%2B'))).toEqual([103, 104, 501, 502]);
    });

    test('several lengths', async () => {
      const both = sortedIds(await programs('length=3&length=5%2B'));
      expect(both).toEqual([103, 104, 501, 502, 601, 602, 701, 702, 801, 802, 1101, 1102, 1201]);
    });
  });

  describe('total years with pre-year', () => {
    test('4 or less: direct entry of 4 years or less, or pre-year + bachelor’s within 4', async () => {
      expect(sortedIds(await programs('total=4-or-less'))).toEqual([
        101, 102, 201, 301, 601, 701, 702, 801, 802, 1101, 1102,
      ]);
    });

    test('4 or less agrees with the shortest total years shown on each card', async () => {
      const everything = await programs('');
      const short = new Set(ids(await programs('total=4-or-less')));
      for (const card of everything.items) {
        const fits = card.shortestTotalYears !== null && card.shortestTotalYears <= 4;
        expect(short.has(card.id), `${card.id}: ${card.shortestTotalYears}`).toBe(fits);
      }
    });

    test('needs a pre-year: bachelor’s with pre_year_required = yes, and pre-years into them', async () => {
      expect(sortedIds(await programs('total=needs-pre-year'))).toEqual([
        103, 104, 202, 401, 402, 403, 501, 502, 701, 702, 801, 802, 1101, 1102,
      ]);
    });

    test('direct entry only: bachelor’s with pre_year_required = no; unknown is left out', async () => {
      const page = await programs('total=direct-entry');
      expect(sortedIds(page)).toEqual([101, 201, 301, 601]);
      expect(ids(page)).not.toContain(102);
    });

    test('path filters combine on the same path', async () => {
      // 1102 leads to two 3-year bachelor's, both 4 years in total.
      expect(sortedIds(await programs('level=foundation&length=3&total=4-or-less'))).toEqual([
        802, 1101, 1102,
      ]);
      // 602 leads to a 3.5-year bachelor's (4.5 in total): a 3-year length, but not 4 or less.
      expect(ids(await programs('length=3&total=4-or-less'))).not.toContain(602);
    });
  });

  test('Ministry-approved only, including college pre-years that lead to an approved university', async () => {
    const page = await programs('approved=1');
    expect(page.total).toBe(19);
    expect(ids(page)).toEqual(expect.arrayContaining([1101, 1102, 1201]));
    for (const excluded of [301, 501, 502]) expect(ids(page)).not.toContain(excluded);
  });

  test('has scholarships: open, published, linked to the program or valid at its university', async () => {
    expect(sortedIds(await programs('scholarships=1'))).toEqual([
      101, 102, 103, 201, 202, 601, 701, 801,
    ]);
    // 403's only scholarship is closed; 301's is unpublished; 104 is a pre-year at a
    // university whose scholarship covers bachelor's programs.
    const page = await programs('scholarships=1');
    for (const excluded of [403, 301, 104]) expect(ids(page)).not.toContain(excluded);
  });

  test('a closed scholarship counts again on a day it was still open', async () => {
    const page = await searchPrograms(
      t.db,
      parseProgramFilters(new URLSearchParams('scholarships=1')),
      {
        lang: 'en',
        today: '2026-11-20',
      },
    );
    expect(ids(page)).toContain(403);
  });

  describe('sort', () => {
    test('tuition low to high, cost not confirmed last', async () => {
      const list = ids(await programs('sort=tuition'));
      expect(list.slice(0, 6)).toEqual([104, 203, 501, 202, 401, 1201]);
      expect(list.at(-1)).toBe(103);
    });

    test('ranking: QS, then THE, ARWU, Moscow; unranked last', async () => {
      const page = await programs('sort=ranking');
      const positions = page.items.map((p) => p.provider.ranking);
      expect(ids(page).slice(0, 4)).toEqual([701, 702, 801, 802]); // QS 50, QS 100
      // Demo University 5 has only a Moscow position (400): before QS 450.
      expect(ids(page).indexOf(501)).toBeLessThan(ids(page).indexOf(101));
      // Demo University 2 has only THE (600), placed like QS 600.
      expect(page.items.find((p) => p.id === 201)?.provider.ranking).toBe(600);
      const ranked = positions.filter((p) => p !== null);
      expect(ranked).toEqual([...ranked].sort((a, b) => a - b));
      expect(positions.slice(ranked.length).every((p) => p === null)).toBe(true);
      expect(
        ids(page)
          .slice(ranked.length)
          .sort((a, b) => a - b),
      ).toEqual([301, 1101, 1102, 1201]);
    });

    test('nearest deadline: upcoming first, soonest first; past and unknown last', async () => {
      const page = await programs('sort=deadline');
      expect(ids(page).slice(0, 4)).toEqual([301, 103, 601, 602]);
      expect(
        ids(page)
          .slice(-4)
          .sort((a, b) => a - b),
      ).toEqual([104, 201, 501, 1201]);
    });

    test('relevance: Ministry-approved first', async () => {
      const page = await programs('');
      const statuses = page.items.map((p) => p.provider.ministryStatus);
      const firstOther = statuses.findIndex((s) => s !== 'approved');
      expect(firstOther).toBe(16);
      expect(statuses.slice(firstOther).includes('approved')).toBe(false);
    });
  });

  test('"Show more": page n holds the first n pages, with a total', async () => {
    const first = await programs('', 'en', 5);
    const second = await programs('page=2', 'en', 5);
    const fifth = await programs('page=5', 'en', 5);
    expect([first.items.length, first.total, first.hasMore]).toEqual([5, 22, true]);
    expect([second.items.length, second.hasMore]).toEqual([10, true]);
    expect([fifth.items.length, fifth.total, fifth.hasMore]).toEqual([22, 22, false]);
    const all = await programs('', 'en', 100);
    expect(ids(second)).toEqual(ids(all).slice(0, 10));
    expect(ids(fifth)).toEqual(ids(all));
  });

  test('names come in the page language, with English as a marked fallback', async () => {
    const tk = await programs('country=TR', 'tk');
    const business = tk.items.find((p) => p.id === 101);
    expect(business?.name).toEqual({ text: 'Biznes dolandyryşy', fallback: false });
    expect(business?.provider.name).toEqual({ text: 'Demo uniwersiteti 1', fallback: false });
    expect(business?.provider.countryName).toEqual({ text: 'Türkiýe', fallback: false });

    const ru = await programs('country=TR', 'ru');
    const architecture = ru.items.find((p) => p.id === 301);
    expect(architecture?.name).toEqual({ text: 'Architecture', fallback: true });
    expect(architecture?.provider.name).toEqual({ text: 'Demo University 3', fallback: true });
    expect(ru.items.find((p) => p.id === 101)?.name.text).toBe('Деловое администрирование');

    const en = await programs('country=TR', 'en');
    expect(en.items.find((p) => p.id === 101)?.name).toEqual({
      text: 'Business Administration',
      fallback: false,
    });
    expect(en.items[0]?.provider.countryName).toEqual({ text: 'Türkiye', fallback: false });
  });

  test('cards carry the facts a card shows, with unknowns left unknown', async () => {
    const page = await programs('');
    const byId = new Map(page.items.map((p) => [p.id, p]));
    expect(byId.get(103)).toMatchObject({
      tuitionPerYearUsd: null,
      preYearRequired: 'yes',
      directEntry: 'no',
      shortestTotalYears: 7,
      lastChecked: '2026-11-17',
      sourceUrl: 'https://example.com/demo/programs/demo-u1-medicine',
    });
    expect(byId.get(102)).toMatchObject({ directEntry: 'unknown', shortestTotalYears: 4 });
    expect(byId.get(601)?.shortestTotalYears).toBe(3.5);
    expect(byId.get(801)?.shortestTotalYears).toBe(4);
    expect(byId.get(104)?.shortestTotalYears).toBe(5);
    // 602's other pathway goes to an unpublished university and is ignored.
    expect(byId.get(602)?.shortestTotalYears).toBe(4.5);
    expect(byId.get(1101)?.provider).toMatchObject({
      type: 'college',
      slug: 'demo-pathway-college-1',
      ministryStatus: null,
      ranking: null,
    });
  });
});

describe('searchUniversities', () => {
  test('with no filters: published universities, approved first, then by ranking', async () => {
    const page = await universities('');
    expect(ids(page)).toEqual([7, 8, 4, 1, 2, 6, 5, 3]);
    expect(page.total).toBe(8);
  });

  test.each([
    ['status=approved', [1, 2, 4, 6, 7, 8]],
    ['status=not_listed&status=unchecked', [3, 5]],
    ['country=TR', [1, 2, 3]],
    ['country=TR&status=approved', [1, 2]],
    // Own foundation year, or a college foundation year leading to one of its bachelor's.
    // Language years don't count.
    ['foundation=1', [2, 4, 6, 7, 8]],
    // Open scholarships only: 4's is closed, 3's is unpublished.
    ['scholarships=1', [1, 2, 6, 7, 8]],
  ])('%s', async (query, expected) => {
    expect(sortedIds(await universities(query))).toEqual(expected);
  });

  test('cards show the Ministry status, its basis and the rankings', async () => {
    const page = await universities('country=RU', 'ru');
    expect(page.items[0]).toMatchObject({
      id: 4,
      name: { text: 'Демо-университет 4', fallback: false },
      countryName: { text: 'Россия', fallback: false },
      ministryStatus: 'approved',
      ministryBasis: 'QS World University Rankings: 300',
      rankings: { qs: 300, the: null, arwu: null, moscow: 150 },
      ranking: 300,
    });
    expect(page.items[1]).toMatchObject({ id: 5, ministryStatus: 'unchecked', ranking: 400 });
  });
});

describe('getProgramWithPathways', () => {
  const get = (slug: string, lang: 'tk' | 'ru' | 'en' = 'en') =>
    getProgramWithPathways(t.db, slug, { lang, today: TODAY });

  test('a bachelor’s that needs a pre-year: only pathway paths, with total years', async () => {
    const page = await get('demo-u7-mechanical-engineering');
    expect(page?.program.directEntry).toBe('no');
    expect(page?.paths).toHaveLength(1);
    expect(page?.paths[0]).toMatchObject({
      kind: 'pathway',
      entryGuaranteed: true,
      totalYears: 4,
      preYear: { id: 1101, level: 'foundation', durationYears: 1, provider: { type: 'college' } },
      bachelor: { id: 701, durationYears: 3 },
    });
  });

  test('a bachelor’s with direct entry: the direct path first, then pathways', async () => {
    const page = await get('demo-u6-computer-science');
    expect(page?.paths.map((p) => [p.kind, p.totalYears])).toEqual([
      ['direct', 3.5],
      ['pathway', 4.5],
      ['pathway', 4.5],
    ]);
    expect(page?.paths[0]).toMatchObject({ kind: 'direct', directEntry: 'yes' });
    const preYears = page?.paths.flatMap((p) => (p.kind === 'pathway' ? [p.preYear.id] : []));
    expect(preYears).toEqual([602, 1201]);
  });

  test('direct entry that isn’t confirmed is shown as unknown', async () => {
    const page = await get('demo-u1-computer-engineering');
    expect(page?.paths).toEqual([
      expect.objectContaining({ kind: 'direct', directEntry: 'unknown', totalYears: 4 }),
    ]);
  });

  test('a language year lists the bachelor’s it leads to, shortest path first', async () => {
    const page = await get('demo-u1-turkish-language-year');
    expect(page?.program.directEntry).toBeNull();
    expect(
      page?.paths.map((p) =>
        p.kind === 'pathway' ? [p.bachelor.id, p.totalYears, p.entryGuaranteed] : [],
      ),
    ).toEqual([
      [202, 5, false],
      [103, 7, true],
    ]);
  });

  test('pathways to unpublished programs are hidden', async () => {
    const page = await get('demo-u6-foundation-year');
    expect(page?.paths.map((p) => p.bachelor.id)).toEqual([601]);
  });

  test('scholarships: direct and university-wide, open first, closed marked', async () => {
    const mech = await get('demo-u7-mechanical-engineering');
    expect(mech?.scholarships).toEqual([
      expect.objectContaining({ id: 3, via: 'program', open: true, rolling: true, daysLeft: null }),
    ]);
    const cs = await get('demo-u6-computer-science');
    expect(cs?.scholarships).toEqual([
      expect.objectContaining({ id: 2, via: 'university', open: true, daysLeft: 20 }),
    ]);
    const software = await get('demo-u4-software-engineering');
    expect(software?.scholarships).toEqual([
      expect.objectContaining({ id: 4, open: false, daysLeft: -5 }),
    ]);
    // A university-wide scholarship covers bachelor's programs, not the pre-year.
    expect((await get('demo-u1-turkish-language-year'))?.scholarships).toEqual([]);
  });

  test('requirements and translated names come with the program', async () => {
    const page = await get('demo-u1-medicine', 'tk');
    expect(page?.program.name).toEqual({ text: 'Lukmançylyk', fallback: false });
    expect(page?.program.requirements.documents).toContain('medical_certificate');
    expect(page?.program.provider.countryName.text).toBe('Türkiýe');
  });

  test('unpublished, hidden or unknown programs return null', async () => {
    expect(await get('demo-u1-draft-program')).toBeNull();
    expect(await get('demo-u9-pharmacy')).toBeNull();
    expect(await get('no-such-program')).toBeNull();
  });
});

describe('getScholarshipWithPrograms', () => {
  const get = (slug: string, lang: 'tk' | 'ru' | 'en' = 'en') =>
    getScholarshipWithPrograms(t.db, slug, { lang, today: TODAY });

  test('a university-wide scholarship lists every published bachelor’s there', async () => {
    const page = await get('demo-scholarship-1');
    expect(page?.universities.map((u) => u.id)).toEqual([1, 2]);
    expect(page?.programs.map((p) => p.id).sort((a, b) => a - b)).toEqual([
      101, 102, 103, 201, 202,
    ]);
    expect(page?.programs.every((p) => p.via === 'university')).toBe(true);
    expect(page?.scholarship).toMatchObject({
      open: true,
      daysLeft: 45,
      coverage: 'full',
      coversPreYear: 'yes',
      openToTurkmen: 'yes',
      covers: ['tuition', 'stipend', 'housing', 'insurance'],
      lastChecked: '2026-11-17',
      sourceUrl: 'https://example.com/demo/scholarship-1',
    });
  });

  test('a program-linked scholarship lists those programs', async () => {
    const page = await get('demo-scholarship-3');
    expect(page?.universities).toEqual([]);
    expect(page?.programs.map((p) => [p.id, p.via])).toEqual([
      [701, 'program'],
      [801, 'program'],
    ]);
    expect(page?.scholarship).toMatchObject({
      rolling: true,
      deadline: null,
      open: true,
      daysLeft: null,
    });
  });

  test('a closed scholarship still has a page, marked closed', async () => {
    expect((await get('demo-scholarship-4'))?.scholarship).toMatchObject({
      open: false,
      daysLeft: -5,
    });
  });

  test('long fields are translated, or English marked as a fallback', async () => {
    const tk = await get('demo-scholarship-1', 'tk');
    expect(tk?.scholarship.name.text).toBe('Demo stipendiýasy 1');
    expect(tk?.scholarship.amountText).toEqual({
      text: 'Doly okuw tölegi we aýda 300 USD',
      fallback: false,
    });
    expect(tk?.scholarship.eligibility).toHaveLength(3);
    expect(tk?.scholarship.eligibility[1]).toBe('1-nji sentýabrda 21 ýaşdan kiçi');
    expect(tk?.scholarship.eligibilityFallback).toBe(false);

    const ru2 = await get('demo-scholarship-2', 'ru');
    expect(ru2?.scholarship.howToApply?.fallback).toBe(true);
    expect(ru2?.scholarship.eligibilityFallback).toBe(true);
    expect(ru2?.scholarship.eligibility).toEqual([
      'Citizen of a partner country',
      'Good school grades',
    ]);

    const en = await get('demo-scholarship-1', 'en');
    expect(en?.scholarship.eligibilityFallback).toBe(false);
    expect(en?.scholarship.amountText).toEqual({
      text: 'Full tuition and 300 USD a month',
      fallback: false,
    });
    // Unknown amount stays unknown.
    expect((await get('demo-scholarship-4'))?.scholarship.amountText).toBeNull();
  });

  test('unpublished or unknown scholarships return null', async () => {
    expect(await get('demo-scholarship-5')).toBeNull();
    expect(await get('nope')).toBeNull();
  });
});
