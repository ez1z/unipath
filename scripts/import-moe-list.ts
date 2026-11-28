/**
 * `pnpm db:import-moe <list.csv>`: match the Ministry's approved list
 * (CSV: university name, country, ranking source, position) to universities
 * in the LOCAL D1. Dry run by default: prints what would change and writes
 * `<list>.review.csv` with every row that needs a person (no match, more than
 * one match, unknown country or ranking).
 *
 *   pnpm db:import-moe list.csv            dry run + review list
 *   pnpm db:import-moe list.csv --apply    set matches to "approved" locally
 *   pnpm db:import-moe list.csv --sql out.sql
 *                                          UPDATE statements by slug for another
 *                                          database (matched against the local D1)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { bumpDataVersion } from '../src/lib/cache.ts';
import {
  loadCountryLookup,
  loadUniversityNames,
  matchMoeList,
  moeStatements,
  readMoeCsv,
  reviewCsv,
} from '../src/lib/import/moe.ts';

const args = process.argv.slice(2);
if (args.includes('--remote')) {
  console.error(
    'This script never connects to a remote database. Use --sql to write a file instead.',
  );
  process.exit(1);
}
const sqlIndex = args.indexOf('--sql');
const sqlOut = sqlIndex >= 0 ? args[sqlIndex + 1] : undefined;
const path = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--sql');
if (!path) {
  console.error('Usage: pnpm db:import-moe <list.csv> [--apply | --sql out.sql]');
  process.exit(1);
}

const rows = readMoeCsv(readFileSync(path, 'utf8'));
const proxy = await getPlatformProxy<Env>({
  configPath: 'wrangler.jsonc',
  persist: true,
  remoteBindings: false,
});
try {
  const db = proxy.env.DB;
  const { matches, review } = matchMoeList(
    rows,
    await loadUniversityNames(db),
    await loadCountryLookup(db),
  );
  const changing = matches.filter((m) => m.changes);
  console.log(`Rows read: ${rows.length}`);
  console.log(
    `Matched: ${matches.length} (${changing.length} would change, ${matches.length - changing.length} already up to date)`,
  );
  for (const m of changing) {
    console.log(`  ${m.university.slug}: ${m.university.ministryStatus} → approved (${m.basis})`);
  }
  console.log(`Needs review: ${review.length}`);
  for (const r of review) console.log(`  line ${r.row.line} ${r.row.name} (${r.reason})`);

  const reviewPath = path.replace(/\.csv$/i, '') + '.review.csv';
  writeFileSync(reviewPath, reviewCsv(review));
  console.log(`\nWrote the review list to ${reviewPath}.`);

  const statements = moeStatements(matches, { file: basename(path) });
  if (sqlOut) {
    writeFileSync(sqlOut, `${statements.join('\n')}\n`);
    console.log(`Wrote ${statements.length} statements to ${sqlOut}. No database was changed.`);
  } else if (args.includes('--apply')) {
    if (statements.length) {
      await db.batch(statements.map((s) => db.prepare(s)));
      await bumpDataVersion(proxy.env.KV);
    }
    console.log(`Applied ${changing.length} change(s) to the local D1.`);
  } else {
    console.log('Dry run: nothing was changed. Add --apply to update the local D1.');
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await proxy.dispose();
}
