import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TOPIC_SLUGS } from '../../src/lib/db/values';
import { COUNTRIES, referenceStatements, TOPIC_NAMES } from '../../src/lib/reference-data';
import { createTestDb, type TestDb } from './db/test-db';

let t: TestDb;
beforeAll(async () => {
  // An empty database, as production starts: migrations only, no demo seed.
  t = await createTestDb({ seed: false });
});
afterAll(() => t.dispose());

const load = () => t.d1.batch(referenceStatements().map((s) => t.d1.prepare(s)));
const count = async (sql: string) => (await t.d1.prepare(sql).first<{ n: number }>())?.n ?? 0;

describe('reference data', () => {
  it('has a name in three languages for every country and board', () => {
    for (const c of COUNTRIES) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
      expect(Object.keys(c.name).sort()).toEqual(['en', 'ru', 'tk']);
    }
    for (const slug of TOPIC_SLUGS) {
      expect(Object.values(TOPIC_NAMES[slug]).every((n) => n.trim() !== '')).toBe(true);
    }
  });

  it('fills an empty database, and loading it again changes nothing', async () => {
    await load();
    await load();
    expect(await count('SELECT count(*) AS n FROM countries')).toBe(COUNTRIES.length);
    expect(await count('SELECT count(*) AS n FROM topics')).toBe(TOPIC_SLUGS.length);
    expect(
      await count(
        "SELECT count(*) AS n FROM translations WHERE entity_type IN ('country', 'topic')",
      ),
    ).toBe((COUNTRIES.length + TOPIC_SLUGS.length) * 3);
    // Nothing else: no demo records.
    expect(await count('SELECT count(*) AS n FROM universities')).toBe(0);
  });

  it('updates a name in place', async () => {
    await t.d1
      .prepare(
        "UPDATE translations SET text = 'old' WHERE entity_type = 'country' AND entity_id = 'TR' AND lang = 'en'",
      )
      .run();
    await load();
    const row = await t.d1
      .prepare(
        "SELECT text FROM translations WHERE entity_type = 'country' AND entity_id = 'TR' AND lang = 'en'",
      )
      .first<{ text: string }>();
    expect(row?.text).toBe(COUNTRIES.find((c) => c.code === 'TR')?.name.en);
  });
});
