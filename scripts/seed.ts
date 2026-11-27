/**
 * `pnpm db:seed`: load the demo data into the LOCAL D1 (.wrangler/state), the
 * same database `pnpm dev` reads. Run `pnpm db:migrate` first.
 *
 * It can't reach a real database: remote bindings are switched off, and the
 * script refuses to run with --remote or NODE_ENV=production.
 */
import { getPlatformProxy } from 'wrangler';
import { bumpDataVersion } from '../src/lib/cache.ts';
import { todayIn } from '../src/lib/dates.ts';
import { createDb } from '../src/lib/db/client.ts';
import { loadDemoData } from './load-demo-data.ts';
import { buildDemoData } from './seed-data.ts';

if (process.argv.includes('--remote') || process.env.NODE_ENV === 'production') {
  console.error('The demo seed only runs against the local D1. Never load it into production.');
  process.exit(1);
}

const proxy = await getPlatformProxy<Env>({
  configPath: 'wrangler.jsonc',
  persist: true,
  remoteBindings: false,
});

try {
  const today = todayIn();
  const counts = await loadDemoData(createDb(proxy.env.DB), buildDemoData(today));
  console.log(`Demo data loaded into the local D1 (dates relative to ${today}):`);
  for (const [table, count] of Object.entries(counts)) console.log(`  ${table}: ${count}`);
  // Cached pages in the local Workers cache refresh on their next view.
  console.log(`  data_version: ${await bumpDataVersion(proxy.env.KV)}`);
} catch (error) {
  console.error(error);
  console.error('\nSeed failed. Did you run `pnpm db:migrate` first?');
  process.exitCode = 1;
} finally {
  await proxy.dispose();
}
