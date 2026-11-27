import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { loadDemoData } from '../../../scripts/load-demo-data.ts';
import { buildDemoData } from '../../../scripts/seed-data.ts';
import { pathwayErrors } from '../../../src/lib/paths.ts';
import { createTestDb, TODAY, type TestDb } from './test-db.ts';

const data = buildDemoData(TODAY);

describe('demo data', () => {
  test('about 30 clearly fake records across 4 countries', () => {
    const records =
      data.universities.length +
      data.pathwayColleges.length +
      data.programs.length +
      data.scholarships.length;
    expect(records).toBeGreaterThanOrEqual(25);
    expect(records).toBeLessThanOrEqual(45);
    expect(data.countries.map((c) => c.code)).toEqual(['TR', 'RU', 'HU', 'GB']);
    for (const r of [...data.universities, ...data.pathwayColleges, ...data.scholarships]) {
      expect(r.name).toMatch(/^Demo /);
    }
    for (const r of [...data.universities, ...data.programs, ...data.scholarships]) {
      if (r.sourceUrl) expect(r.sourceUrl).toMatch(/^https:\/\/example\.com\/demo\//);
    }
  });

  test('has every level, at universities and at colleges', () => {
    const levels = new Set(data.programs.map((p) => `${p.level}@${p.providerType}`));
    for (const level of [
      'bachelor@university',
      'foundation@university',
      'language@university',
      'foundation@college',
      'language@college',
    ]) {
      expect(levels).toContain(level);
    }
  });

  test('every pathway goes from a pre-year to a bachelor’s', () => {
    const byId = new Map(data.programs.map((p) => [p.id, p]));
    for (const pathway of data.pathways) {
      const from = byId.get(pathway.fromProgramId);
      const to = byId.get(pathway.toProgramId);
      expect(from && to, `pathway ${pathway.id}`).toBeTruthy();
      if (from && to) expect(pathwayErrors(from, to), `pathway ${pathway.id}`).toEqual([]);
    }
  });

  test('every published record has a source and a last-checked date', () => {
    for (const r of [
      ...data.universities,
      ...data.pathwayColleges,
      ...data.programs,
      ...data.scholarships,
    ]) {
      expect(r.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (r.published) expect(r.sourceUrl, r.name).toBeTruthy();
    }
  });

  test('names are translated into Turkmen; a few Russian ones are left out on purpose', () => {
    const tk = new Set(
      data.translations
        .filter((t) => t.lang === 'tk' && t.field === 'name')
        .map((t) => `${t.entityType}:${t.entityId}`),
    );
    for (const p of data.programs) expect(tk).toContain(`program:${p.id}`);
    for (const u of data.universities) expect(tk).toContain(`university:${u.id}`);
    const ru = data.translations.filter((t) => t.lang === 'ru' && t.field === 'name');
    expect(ru.length).toBeLessThan(tk.size);
  });
});

describe('loading the demo data', () => {
  let t: TestDb;
  beforeAll(async () => {
    t = await createTestDb({ seed: false });
  }, 60_000);
  afterAll(async () => {
    await t.dispose();
  });

  const count = async (table: string) => {
    const row = await t.d1.prepare(`select count(*) as n from ${table}`).first<{ n: number }>();
    return row?.n;
  };

  test('loads into an empty, migrated database, and loading again replaces it', async () => {
    const counts = await loadDemoData(t.db, data);
    expect(counts).toMatchObject({ programs: data.programs.length, pathways: 13 });
    const before = {
      programs: await count('programs'),
      translations: await count('translations'),
      topics: await count('topics'),
    };
    expect(before).toEqual({
      programs: data.programs.length,
      translations: data.translations.length,
      topics: 6,
    });

    await loadDemoData(t.db, buildDemoData('2027-03-01'));
    expect({
      programs: await count('programs'),
      translations: await count('translations'),
      topics: await count('topics'),
    }).toEqual(before);
    const setting = await t.d1
      .prepare(`select value from settings where key = 'usd_tmt_rate_date'`)
      .first<{ value: string }>();
    expect(setting?.value).toBe('2027-03-01');
  });
});
