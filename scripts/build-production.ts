/**
 * Builds the live site: `astro build` with CLOUDFLARE_ENV=production, so the
 * Worker gets wrangler.jsonc `env.production` (the environment is fixed at
 * build time). Works the same on Windows, macOS and Linux.
 *
 *   pnpm build:production      build only
 *   pnpm deploy:check          build, then `wrangler deploy --dry-run` (uploads nothing)
 *
 * Deploying itself is a separate, deliberate step: see DEPLOY.md.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Runs a package's own entry file with this Node (no shell, so no quoting surprises). */
const run = (entry: string, args: string[]) =>
  execFileSync(process.execPath, [entry, ...args], {
    stdio: 'inherit',
    env: { ...process.env, CLOUDFLARE_ENV: 'production' },
  });

run('node_modules/astro/bin/astro.mjs', ['build']);

// The built config must be production's, never the local one.
const built = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8')) as {
  vars?: Record<string, string>;
};
if (built.vars?.['DEV_MAILBOX'] || !built.vars?.['SITE_URL']?.startsWith('https://')) {
  throw new Error('dist/server/wrangler.json is not the production config');
}
console.log(`Built for production: ${built.vars['SITE_URL']}`);

if (process.argv.includes('--dry-run')) {
  run('node_modules/wrangler/bin/wrangler.js', ['deploy', '--dry-run']);
}
