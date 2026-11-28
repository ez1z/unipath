/**
 * `pnpm db:backup`: write a backup of the LOCAL D1 to the local R2 bucket
 * (.wrangler/state), the same file the nightly cron makes in production:
 * `backups/YYYY-MM-DD.sql`. Add `--print` to also print the SQL.
 */
import { getPlatformProxy } from 'wrangler';
import { runBackup } from '../src/lib/backup.ts';
import { todayIn } from '../src/lib/dates.ts';

if (process.argv.includes('--remote')) {
  console.error('This script only backs up the local D1. Production backups run on the cron.');
  process.exit(1);
}

const proxy = await getPlatformProxy<Env>({
  configPath: 'wrangler.jsonc',
  persist: true,
  remoteBindings: false,
});

try {
  const result = await runBackup(proxy.env.DB, proxy.env.FILES, todayIn());
  console.log(`Wrote ${result.key} (${result.bytes} bytes) to the local R2 bucket.`);
  if (result.deleted.length) console.log(`Removed old backups: ${result.deleted.join(', ')}`);
  if (process.argv.includes('--print')) {
    const object = await proxy.env.FILES.get(result.key);
    console.log(await object?.text());
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await proxy.dispose();
}
