/**
 * Imports: the "clavis-records/1" JSON file (drafts only, existing slugs
 * skipped, all-or-nothing on problems) and the Ministry list matcher.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  loadCountryLookup,
  loadUniversityNames,
  matchMoeList,
  moeStatements,
  normalizeName,
  parseCsv,
  rankingColumn,
  readMoeCsv,
  reviewCsv,
} from '../../src/lib/import/moe.ts';
import { loadImportTarget, planImport } from '../../src/lib/import/plan.ts';
import { recordsJsonSchema } from '../../src/lib/import/records.ts';
import { createTestDb, TODAY, type TestDb } from './db/test-db.ts';

const example = JSON.parse(
  readFileSync(new URL('../../docs/examples/records.example.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const minimal = (extra: Record<string, unknown>) => ({ format: 'clavis-records/1', ...extra });

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(async () => {
  await t?.dispose();
});

const run = async (statements: string[]) => {
  await t.d1.batch(statements.map((s) => t.d1.prepare(s)));
};

describe('records.schema.json', () => {
  it('matches the Zod schema (run `pnpm db:import --schema` after changing it)', () => {
    const onDisk = JSON.parse(
      readFileSync(new URL('../../docs/records.schema.json', import.meta.url), 'utf8'),
    ) as unknown;
    expect(onDisk).toEqual(recordsJsonSchema());
  });
});

describe('planImport', () => {
  it('imports the example file as unpublished drafts, with texts, links and audit rows', async () => {
    const plan = planImport(example, await loadImportTarget(t.d1), {
      today: TODAY,
      file: 'example.json',
    });
    expect(plan.report.problems).toEqual([]);
    expect(plan.report.created).toHaveLength(7);
    await run(plan.statements);

    const drafts = await t.d1
      .prepare(
        `SELECT slug, published FROM universities WHERE slug LIKE 'example-%'
         UNION ALL SELECT slug, published FROM programs WHERE slug LIKE 'example-%'
         UNION ALL SELECT slug, published FROM scholarships WHERE slug LIKE 'example-%'
         UNION ALL SELECT slug, published FROM pathway_colleges WHERE slug LIKE 'example-%'`,
      )
      .all<{ slug: string; published: number }>();
    expect(drafts.results).toHaveLength(6);
    expect(drafts.results.every((r) => r.published === 0)).toBe(true);

    const program = await t.d1
      .prepare(
        `SELECT p.tuition_per_year_usd, p.requirements, p.last_checked, p.pre_year_required, u.slug AS uni
         FROM programs p JOIN universities u ON u.id = p.university_id WHERE p.slug = 'example-university-a-computing-bsc'`,
      )
      .first<Record<string, unknown>>();
    expect(program).toMatchObject({
      tuition_per_year_usd: null,
      last_checked: TODAY,
      pre_year_required: 'unknown',
      uni: 'example-university-a',
    });
    expect(JSON.parse(String(program?.['requirements']))).toEqual({
      ieltsMin: 6,
      otherTests: [{ name: 'SAT', min: '1100' }],
      documents: ['passport', 'school_certificate', 'transcript', 'motivation_letter'],
    });

    const tk = await t.d1
      .prepare(
        `SELECT text FROM translations WHERE entity_type = 'university' AND lang = 'tk' AND field = 'name'
         AND entity_id = (SELECT CAST(id AS TEXT) FROM universities WHERE slug = 'example-university-a')`,
      )
      .first<{ text: string }>();
    expect(tk?.text).toBe('Mysal uniwersiteti A');

    const links = await t.d1
      .prepare(
        `SELECT (SELECT count(*) FROM pathways p JOIN programs f ON f.id = p.from_program_id
                 WHERE f.slug = 'example-university-a-turkish-year') AS pathways,
                (SELECT count(*) FROM scholarship_programs sp JOIN scholarships s ON s.id = sp.scholarship_id
                 WHERE s.slug = 'example-scholarship-a') AS scholarshipPrograms,
                (SELECT count(*) FROM audit_log WHERE action = 'import') AS audits`,
      )
      .first<Record<string, number>>();
    expect(links).toEqual({ pathways: 1, scholarshipPrograms: 1, audits: 7 });
  });

  it('skips records whose slug already exists, and never changes them', async () => {
    const plan = planImport(example, await loadImportTarget(t.d1), { today: TODAY });
    expect(plan.report.created).toEqual([]);
    expect(plan.report.skipped).toHaveLength(7);
    expect(plan.statements).toEqual([]);
  });

  it('can point at records already in Clavis', async () => {
    const plan = planImport(
      minimal({
        programs: [
          {
            slug: 'imported-at-demo-1',
            name: { en: 'Imported program' },
            university: 'demo-university-1',
            level: 'foundation',
            language_of_study: 'en',
            duration_years: 1,
          },
        ],
      }),
      await loadImportTarget(t.d1),
      { today: TODAY },
    );
    expect(plan.report.problems).toEqual([]);
    await run(plan.statements);
    const row = await t.d1
      .prepare(`SELECT pre_year_required, field FROM programs WHERE slug = 'imported-at-demo-1'`)
      .first();
    expect(row).toEqual({ pre_year_required: null, field: null });
  });

  it('reports every problem and writes nothing', async () => {
    const plan = planImport(
      minimal({
        universities: [
          { slug: 'bad-a', name: { en: 'A' }, country: 'XX', city: 'C' },
          {
            slug: 'bad-b',
            name: { en: 'B' },
            country: 'TR',
            city: 'C',
            ministry_status: 'approved',
          },
          { slug: 'bad-b', name: { en: 'B again' }, country: 'TR', city: 'C' },
        ],
        programs: [
          {
            slug: 'bad-p',
            name: { en: 'P' },
            university: 'no-such-uni',
            level: 'bachelor',
            language_of_study: 'en',
            duration_years: 4,
          },
        ],
        pathways: [{ from: 'demo-university-1-business', to: 'bad-p' }],
      }),
      await loadImportTarget(t.d1),
      { today: TODAY },
    );
    expect(plan.statements).toEqual([]);
    expect(plan.report.created).toEqual([]);
    const messages = plan.report.problems.map((p) => `${p.path}: ${p.message}`);
    expect(messages).toEqual(
      expect.arrayContaining([
        'universities[0].country: country "XX" is not in Clavis',
        'universities[1].ministry_basis: "approved" needs the basis (which list, order or letter)',
        'universities[2].slug: "bad-b" appears twice in this file',
        'programs[0].university: no university "no-such-uni"',
      ]),
    );
  });

  it('refuses fields it does not know, with their place in the file', () => {
    const plan = planImport(
      minimal({
        universities: [{ slug: 'x', name: { en: 'X' }, country: 'TR', city: 'C', tuition: 5 }],
      }),
      null,
      { today: TODAY },
    );
    expect(plan.report.problems[0]?.path).toBe('universities[0]');
    expect(plan.report.problems[0]?.message).toMatch(/tuition/);
    expect(planImport({ format: 'other/1' }, null, { today: TODAY }).report.problems[0]?.path).toBe(
      'format',
    );
  });

  it('for a --sql file, lists the countries and slugs the target must already have', () => {
    const plan = planImport(
      minimal({
        programs: [
          {
            slug: 'sql-p',
            name: { en: 'P' },
            university: 'somewhere-else',
            level: 'bachelor',
            language_of_study: 'en',
            duration_years: 4,
          },
        ],
        scholarships: [
          {
            slug: 'sql-s',
            name: { en: 'S' },
            provider: 'X',
            country: 'HU',
            coverage: 'full',
            programs: ['sql-p'],
          },
        ],
      }),
      null,
      { today: TODAY },
    );
    expect(plan.report.problems).toEqual([]);
    expect(plan.report.assumed).toEqual([
      { type: 'university', key: 'somewhere-else' },
      { type: 'country', key: 'HU' },
    ]);
    expect(plan.statements.join('\n')).toContain(
      "(SELECT id FROM universities WHERE slug = 'somewhere-else')",
    );
  });
});

describe('Ministry list', () => {
  it('reads CSV with quotes, a header row and Windows line ends', () => {
    expect(parseCsv('a,"b, ""c""",d\r\n\r\ne,f,g,h')).toEqual([
      ['a', 'b, "c"', 'd'],
      ['e', 'f', 'g', 'h'],
    ]);
    expect(parseCsv(String.fromCharCode(0xfeff) + 'Name,Country')).toEqual([['Name', 'Country']]);
    expect(readMoeCsv('University name,Country,Ranking source,Position\nX,TR,QS,5\n')).toEqual([
      { line: 2, name: 'X', country: 'TR', source: 'QS', position: '5' },
    ]);
  });

  it('compares names without case, accents or punctuation', () => {
    expect(normalizeName('Universität  Wien!')).toBe(normalizeName('universitat-wien'));
    expect(normalizeName('A & B')).toBe('a and b');
    expect(rankingColumn('Times Higher Education 2026')).toBe('ranking_the');
    expect(rankingColumn('Shanghai')).toBe('ranking_arwu');
    expect(rankingColumn('MosIUR')).toBe('ranking_moscow');
    expect(rankingColumn('Webometrics')).toBeNull();
  });

  it('approves exact matches and sends everything else to the review list', async () => {
    const rows = readMoeCsv(
      [
        'Name,Country,Source,Position',
        'demo university 1,Türkiye,QS,=312',
        'Demo University 2,TR,Webometrics,4',
        'Demo Univ,TR,QS,10',
        'Demo University 3,Atlantis,QS,5',
        'Demo University 3,TR,QS,n/a',
      ].join('\n'),
    );
    const { matches, review } = matchMoeList(
      rows,
      await loadUniversityNames(t.d1),
      await loadCountryLookup(t.d1),
    );
    expect(matches.map((m) => [m.university.slug, m.basis])).toEqual([
      ['demo-university-1', 'QS 312'],
    ]);
    expect(review.map((r) => r.reason)).toEqual([
      'unknown_source',
      'no_match',
      'unknown_country',
      'bad_position',
    ]);
    expect(reviewCsv(review).split('\n')[0]).toBe(
      'line,name,country,ranking_source,position,reason,candidates',
    );

    await run(moeStatements(matches, { file: 'list.csv' }));
    const u = await t.d1
      .prepare(
        `SELECT ministry_status, ministry_basis, ranking_qs FROM universities WHERE slug = 'demo-university-1'`,
      )
      .first();
    expect(u).toEqual({ ministry_status: 'approved', ministry_basis: 'QS 312', ranking_qs: 312 });

    // A second run changes nothing.
    const again = matchMoeList(
      rows,
      await loadUniversityNames(t.d1),
      await loadCountryLookup(t.d1),
    );
    expect(moeStatements(again.matches, { file: 'list.csv' })).toEqual([]);
  });
});
