import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSitemapEntries, robotsTxt, sitemapXml, STATIC_PATHS } from '../../src/lib/sitemap';
import { createTestDb, type TestDb } from './db/test-db';

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
}, 60_000);
afterAll(() => t.dispose());

describe('sitemap', () => {
  it('lists the static pages and only published records', async () => {
    const entries = await loadSitemapEntries(t.d1);
    const paths = entries.map((e) => e.path);
    for (const p of STATIC_PATHS) expect(paths).toContain(p);
    expect(paths).toContain('/universities/demo-university-1');

    const count = async (sql: string) => (await t.d1.prepare(sql).first<{ n: number }>())?.n ?? 0;
    expect(paths.filter((p) => p.startsWith('/universities/'))).toHaveLength(
      await count('SELECT count(*) AS n FROM universities WHERE published = 1'),
    );
    expect(paths.filter((p) => p.startsWith('/scholarships/'))).toHaveLength(
      await count('SELECT count(*) AS n FROM scholarships WHERE published = 1'),
    );
    expect(entries.find((e) => e.path.startsWith('/programs/'))?.lastmod).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it('drops a record as soon as it is unpublished, with its programs', async () => {
    const uni = await t.d1
      .prepare(
        `SELECT u.id, u.slug, p.slug AS program FROM universities u
         JOIN programs p ON p.university_id = u.id
         WHERE u.published = 1 AND p.published = 1 LIMIT 1`,
      )
      .first<{ id: number; slug: string; program: string }>();
    if (!uni) throw new Error('seed has no published program');
    await t.d1.prepare('UPDATE universities SET published = 0 WHERE id = ?').bind(uni.id).run();
    try {
      const paths = (await loadSitemapEntries(t.d1)).map((e) => e.path);
      expect(paths).not.toContain(`/universities/${uni.slug}`);
      expect(paths).not.toContain(`/programs/${uni.program}`);
    } finally {
      await t.d1.prepare('UPDATE universities SET published = 1 WHERE id = ?').bind(uni.id).run();
    }
  });

  it('every record query uses an index', async () => {
    for (const table of ['universities', 'pathway_colleges', 'scholarships']) {
      const plan = await t.d1
        .prepare(`EXPLAIN QUERY PLAN SELECT slug, last_checked FROM ${table} WHERE published = 1`)
        .all<{ detail: string }>();
      expect(plan.results.map((r) => r.detail).join(' ')).toMatch(/USING (COVERING )?INDEX/);
    }
  });

  it('writes each page in three languages with hreflang alternates', () => {
    const out = sitemapXml('https://clavis.example/', [
      { path: '/universities/a&b', lastmod: '2026-11-01' },
    ]);
    expect(out.match(/<url>/g)).toHaveLength(3);
    expect(out).toContain('<loc>https://clavis.example/ru/universities/a&amp;b</loc>');
    expect(out).toContain('<lastmod>2026-11-01</lastmod>');
    expect(out).toContain(
      'hreflang="x-default" href="https://clavis.example/tk/universities/a&amp;b"',
    );
  });

  it('robots.txt names the sitemap and keeps private pages out', () => {
    const robots = robotsTxt('https://clavis.example');
    expect(robots).toContain('Sitemap: https://clavis.example/sitemap.xml');
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Disallow: /en/my');
  });
});
