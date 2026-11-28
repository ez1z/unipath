/**
 * The nightly backup: the SQL file restores into an empty database with the
 * same rows (sessions and sign-in codes left out), working full-text search
 * and working triggers; only the newest 30 files are kept.
 */
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BACKUPS_KEPT, dumpDatabase, runBackup, sqlValue } from '../../src/lib/backup.ts';
import { createTestDb, type TestDb } from './db/test-db.ts';

let t: TestDb;
let restored: DatabaseSync;

const count = (db: DatabaseSync, table: string) =>
  Number((db.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }).n);

beforeAll(async () => {
  t = await createTestDb();
  const now = Date.now();
  await t.d1.batch([
    t.d1.prepare(
      `INSERT INTO user (id, name, email, created_at, updated_at) VALUES ('u1', 'O''Brien', 'a@example.com', ${now}, ${now})`,
    ),
    t.d1.prepare(
      `INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id) VALUES ('s1', ${now + 1e6}, 'tok', ${now}, ${now}, 'u1')`,
    ),
    t.d1.prepare(
      `INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES ('v1', 'a@example.com', '123456', ${now + 1e6}, ${now}, ${now})`,
    ),
    t.d1.prepare(
      `INSERT INTO threads (id, topic_slug, title, body, author_id, lang) SELECT 1, slug, 'Visa for Türkiye?', 'Line one\nline ''two''', 'u1', 'en' FROM topics LIMIT 1`,
    ),
  ]);
  restored = new DatabaseSync(':memory:');
  // D1 runs an imported --file as one unit (like `wrangler d1 export` files,
  // which use the same PRAGMA); node:sqlite needs the transaction spelled out.
  restored.exec(['BEGIN;', await dumpDatabase(t.d1), 'COMMIT;'].join('\n'));
}, 60_000);

afterAll(async () => {
  restored?.close();
  await t?.dispose();
});

describe('sqlValue', () => {
  it('writes SQL literals', () => {
    expect(sqlValue(null)).toBe('NULL');
    expect(sqlValue(12.5)).toBe('12.5');
    expect(sqlValue("it's")).toBe("'it''s'");
    expect(sqlValue(new Uint8Array([0, 255]))).toBe("X'00ff'");
    expect(sqlValue(Number.NaN)).toBe('NULL');
  });
});

describe('dumpDatabase', () => {
  it('restores every table with the same rows, except sessions and codes', async () => {
    const { results } = await t.d1
      .prepare(
        `SELECT name, sql FROM sqlite_master WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`,
      )
      .all<{ name: string; sql: string }>();
    const plain = results.filter(
      (r) => !/^CREATE VIRTUAL/i.test(r.sql) && !/_(data|idx|content|docsize|config)$/.test(r.name),
    );
    expect(plain.length).toBeGreaterThan(20);
    for (const { name } of plain) {
      const row = await t.d1.prepare(`SELECT count(*) AS n FROM "${name}"`).first<{ n: number }>();
      const expected = name === 'session' || name === 'verification' ? 0 : Number(row?.n);
      expect(count(restored, name), name).toBe(expected);
    }
    expect(count(restored, 'programs')).toBeGreaterThan(0);
  });

  it('keeps text exactly, quotes and new lines included', () => {
    const thread = restored.prepare('SELECT title, body FROM threads WHERE id = 1').get();
    expect(thread).toEqual({ title: 'Visa for Türkiye?', body: "Line one\nline 'two'" });
    expect(restored.prepare("SELECT name FROM user WHERE id = 'u1'").get()).toEqual({
      name: "O'Brien",
    });
  });

  it('restores full-text search, including the thread index rebuilt from threads', () => {
    expect(count(restored, 'program_search')).toBe(count(restored, 'programs'));
    const hit = restored
      .prepare("SELECT rowid FROM thread_search WHERE thread_search MATCH 'turkiye'")
      .all();
    expect(hit).toEqual([{ rowid: 1 }]);
  });

  it('restores triggers and foreign keys after the data', () => {
    restored.exec('PRAGMA foreign_keys = on');
    expect(restored.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    const triggers = restored
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'threads_search_insert'",
      )
      .all();
    expect(triggers).toHaveLength(1);
  });
});

describe('runBackup', () => {
  it('writes backups/<date>.sql and keeps only the newest 30', async () => {
    for (let day = 1; day <= 31; day++) {
      await t.files.put(`backups/2026-10-${String(day).padStart(2, '0')}.sql`, 'old');
    }
    const result = await runBackup(t.d1, t.files, '2026-12-01');
    expect(result.key).toBe('backups/2026-12-01.sql');
    expect(result.deleted).toEqual(['backups/2026-10-02.sql', 'backups/2026-10-01.sql']);
    const listed = await t.files.list({ prefix: 'backups/' });
    expect(listed.objects).toHaveLength(BACKUPS_KEPT);
    const today = await t.files.get('backups/2026-12-01.sql');
    expect(await today?.text()).toContain('CREATE TABLE');
  });
});
