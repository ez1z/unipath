/**
 * `pnpm db:reference`: load the reference data (countries and their names,
 * discussion boards) from src/lib/reference-data.ts into the LOCAL D1.
 * Safe to run again: rows are updated, never deleted.
 *
 *   pnpm db:reference                  the local D1
 *   pnpm db:reference --sql out.sql    write the SQL for production (DEPLOY.md)
 */
import { writeFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { bumpDataVersion } from '../src/lib/cache.ts';
import { referenceStatements } from '../src/lib/reference-data.ts';

const args = process.argv.slice(2);
if (args.includes('--remote')) {
  console.error('This script never connects to a remote database. Use --sql to write a file.');
  process.exit(1);
}
const statements = referenceStatements();
const sqlAt = args.indexOf('--sql');

if (sqlAt >= 0) {
  const out = args[sqlAt + 1];
  if (!out) {
    console.error('Usage: pnpm db:reference --sql out.sql');
    process.exit(1);
  }
  writeFileSync(
    out,
    `-- Clavis reference data: countries and discussion boards.\n${statements.join('\n')}\n`,
  );
  console.log(`Wrote ${statements.length} statements to ${out}. No database was touched.`);
} else {
  const proxy = await getPlatformProxy<Env>({
    configPath: 'wrangler.jsonc',
    persist: true,
    remoteBindings: false,
  });
  try {
    await proxy.env.DB.batch(statements.map((s) => proxy.env.DB.prepare(s)));
    await bumpDataVersion(proxy.env.KV);
    console.log(`Loaded ${statements.length} reference rows into the local D1.`);
  } finally {
    await proxy.dispose();
  }
}
