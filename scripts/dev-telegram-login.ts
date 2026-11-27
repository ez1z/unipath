/**
 * Local stand-in for "Continue with Telegram": prints a sign-in link signed with
 * the made-up TELEGRAM_BOT_TOKEN in .dev.vars, as if the Login Widget had sent
 * the browser back. Open it while `pnpm preview` runs. Never use a real token.
 *
 *   pnpm exec node scripts/dev-telegram-login.ts [telegram-id] [lang]
 */
import { readFileSync } from 'node:fs';
import { signLoginWidget } from '../src/lib/auth/telegram.ts';

const vars = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
const token = /^TELEGRAM_BOT_TOKEN=(.+)$/m.exec(vars)?.[1]?.trim();
if (!token)
  throw new Error('TELEGRAM_BOT_TOKEN is missing from .dev.vars (copy .dev.vars.example)');

const id = process.argv[2] ?? '100000001';
const lang = process.argv[3] ?? 'tk';
const site = /^SITE_URL=(.+)$/m.exec(vars)?.[1]?.trim() ?? 'http://localhost:4321';
const params = await signLoginWidget(
  { id, auth_date: String(Math.floor(Date.now() / 1000)) },
  token,
);
params.set('next', `/${lang}/auth/continue`);
params.set('fail', `/${lang}/sign-in`);
console.log(`${site}/api/auth/telegram/callback?${params}`);
