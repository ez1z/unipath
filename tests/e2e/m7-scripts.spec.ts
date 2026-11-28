/**
 * M7 checks for the scripts (SPEC): an import produces unpublished drafts and
 * a report; a backup file appears in local R2.
 *
 * Run once, by the "scripts" project, after the phone and desktop projects:
 * each script starts its own local Workers runtime on the shared local
 * database, which would slow down the browser tests running alongside.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { ownIpPerTest, uniqueEmail } from './account.ts';
import { script, signInAsAdmin } from './admin.ts';
import { msg } from './helpers.ts';

ownIpPerTest();

test('an import creates unpublished drafts and prints a report', async ({ page }, info) => {
  const slug = `e2e-import-${Date.now()}`;
  const dir = mkdtempSync(join(tmpdir(), 'clavis-import-'));
  const file = join(dir, 'records.json');
  writeFileSync(
    file,
    JSON.stringify({
      format: 'clavis-records/1',
      source: 'e2e test',
      universities: [
        {
          slug,
          name: { en: `E2E Import University ${slug}` },
          country: 'TR',
          city: 'Testville',
          source_url: 'https://example.org/e2e',
        },
        { slug: 'demo-university-1', name: { en: 'Already here' }, country: 'TR', city: 'X' },
      ],
    }),
  );
  const report = script('scripts/import-records.ts', file);
  expect(report).toContain('Drafts created: 1');
  expect(report).toContain(`+ university ${slug}`);
  expect(report).toContain('= university demo-university-1');

  const bad = join(dir, 'bad.json');
  writeFileSync(bad, JSON.stringify({ format: 'clavis-records/1', universities: [{ slug: 'x' }] }));
  expect(() => script('scripts/import-records.ts', bad)).toThrow(/Nothing was imported/);

  // A draft: not on the site, listed in /admin.
  expect((await page.goto(`/en/universities/${slug}`))?.status()).toBe(404);
  await signInAsAdmin(page, uniqueEmail(info, 'admin-import'));
  await page.goto(`/admin/universities?published=no&q=${slug}`);
  const row = page.getByRole('listitem').filter({ hasText: slug.slice(0, 10) });
  await expect(row.getByText(msg('en', 'admin.draft'))).toBeVisible();
});

test('a backup file appears in local R2', () => {
  const output = script('scripts/backup-now.ts', '--print');
  expect(output).toMatch(/Wrote backups\/\d{4}-\d{2}-\d{2}\.sql \(\d+ bytes\)/);
  expect(output).toContain('CREATE TABLE');
  expect(output).toContain('INSERT INTO "universities"');
  expect(output).not.toContain('INSERT INTO "session"');
});
