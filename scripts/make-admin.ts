/**
 * `pnpm make-admin <email>`: give an account the admin role in the LOCAL D1
 * (the account must have signed in once). `--revoke` makes it a student again.
 *
 * In production, run the same UPDATE with Wrangler yourself (DEPLOY.md):
 *   wrangler d1 execute clavis --remote --command "UPDATE user SET role = 'admin' WHERE email = '…'"
 */
import { getPlatformProxy } from 'wrangler';

const args = process.argv.slice(2);
if (args.includes('--remote')) {
  console.error('This script only changes the local D1. See DEPLOY.md for production.');
  process.exit(1);
}
const email = args
  .find((a) => !a.startsWith('--'))
  ?.trim()
  .toLowerCase();
if (!email || !email.includes('@')) {
  console.error('Usage: pnpm make-admin <email> [--revoke]');
  process.exit(1);
}
const role = args.includes('--revoke') ? 'student' : 'admin';

const proxy = await getPlatformProxy<Env>({
  configPath: 'wrangler.jsonc',
  persist: true,
  remoteBindings: false,
});
try {
  const db = proxy.env.DB;
  const result = await db
    .prepare('UPDATE user SET role = ?, updated_at = ? WHERE email = ?')
    .bind(role, Date.now(), email)
    .run();
  if (result.meta.changes === 0) {
    console.error(`No account with ${email}. Sign in once on the local site first.`);
    process.exitCode = 1;
  } else {
    await db
      .prepare(
        `INSERT INTO audit_log (admin_id, action, entity_type, entity_id, diff)
         SELECT NULL, ?, 'user', id, ? FROM user WHERE email = ?`,
      )
      .bind(role === 'admin' ? 'grant' : 'revoke', JSON.stringify({ role }), email)
      .run();
    console.log(`${email} is now ${role === 'admin' ? 'an admin' : 'a student'} (local D1).`);
  }
} finally {
  await proxy.dispose();
}
