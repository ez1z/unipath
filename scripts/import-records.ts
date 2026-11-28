/**
 * `pnpm db:import <file.json>`: import a "clavis-records/1" file
 * (docs/data-format.md) into the LOCAL D1 as unpublished drafts, and print
 * a report: drafts created, records skipped because their slug exists, and
 * every problem found. Any problem: nothing is written.
 *
 *   pnpm db:import docs/examples/records.example.json
 *   pnpm db:import file.json --dry-run        report only, write nothing
 *   pnpm db:import file.json --sql out.sql    write SQL for another database
 *                                             (wrangler d1 execute … --file out.sql);
 *                                             touches no database
 *   pnpm db:import --schema                   regenerate docs/records.schema.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { bumpDataVersion } from '../src/lib/cache.ts';
import { todayIn } from '../src/lib/dates.ts';
import { formatReport, loadImportTarget, planImport } from '../src/lib/import/plan.ts';
import { recordsJsonSchema } from '../src/lib/import/records.ts';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

if (flag('--remote')) {
  console.error(
    'This script never connects to a remote database. Use --sql to write a file instead.',
  );
  process.exit(1);
}

if (flag('--schema')) {
  writeFileSync('docs/records.schema.json', `${JSON.stringify(recordsJsonSchema(), null, 2)}\n`);
  console.log('Wrote docs/records.schema.json');
  process.exit(0);
}

const sqlOut = option('--sql');
const path = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--sql');
if (!path) {
  console.error('Usage: pnpm db:import <file.json> [--dry-run] [--sql out.sql]');
  process.exit(1);
}

let input: unknown;
try {
  input = JSON.parse(readFileSync(path, 'utf8'));
} catch (error) {
  console.error(`Could not read ${path} as JSON: ${(error as Error).message}`);
  process.exit(1);
}
const today = todayIn();
const file = basename(path);

if (sqlOut) {
  const plan = planImport(input, null, { today, file });
  console.log(formatReport(plan.report, { dryRun: true }));
  if (plan.report.problems.length > 0) process.exit(1);
  const header = [
    `-- Clavis import of ${file}, ${today}: ${plan.report.created.length} unpublished drafts.`,
    '-- Run on a database that already has every country and slug listed in the report.',
    '-- A slug that already exists there makes the whole file fail; nothing is written.',
    'PRAGMA defer_foreign_keys = on;',
  ];
  writeFileSync(sqlOut, `${[...header, ...plan.statements].join('\n')}\n`);
  console.log(
    `\nWrote ${plan.statements.length} statements to ${sqlOut}. No database was touched.`,
  );
  process.exit(0);
}

const proxy = await getPlatformProxy<Env>({
  configPath: 'wrangler.jsonc',
  persist: true,
  remoteBindings: false,
});
try {
  const plan = planImport(input, await loadImportTarget(proxy.env.DB), { today, file });
  console.log(formatReport(plan.report, { dryRun: flag('--dry-run') }));
  if (plan.report.problems.length > 0) {
    process.exitCode = 1;
  } else if (flag('--dry-run')) {
    console.log('\nDry run: nothing was written.');
  } else if (plan.statements.length > 0) {
    // One batch = one transaction: all of it or none of it.
    await proxy.env.DB.batch(plan.statements.map((s) => proxy.env.DB.prepare(s)));
    await bumpDataVersion(proxy.env.KV);
    console.log('\nImported into the local D1.');
  }
} catch (error) {
  console.error(error);
  console.error('\nImport failed; nothing was written. Did you run `pnpm db:migrate`?');
  process.exitCode = 1;
} finally {
  await proxy.dispose();
}
