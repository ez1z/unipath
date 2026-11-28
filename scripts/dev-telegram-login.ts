/**
 * Local stand-in for "Continue with Telegram". Telegram's button can't finish
 * on localhost, so this does its last step: it takes the button's return URL
 * from our Telegram page and adds login data signed with the made-up
 * TELEGRAM_BOT_TOKEN in .dev.vars. Never use a real token.
 *
 * 1. With `pnpm preview` running, open http://localhost:4321/en/sign-in/telegram
 *    (this sets the one-time state cookie in your browser).
 * 2. In DevTools, copy the `data-auth-url` of the `<script data-telegram-login>`.
 * 3. pnpm exec node scripts/dev-telegram-login.ts "<data-auth-url>" [telegram-id]
 * 4. Open the printed link in the same browser within 10 minutes.
 */
import { readFileSync } from 'node:fs';
import { signLoginWidget } from '../src/lib/auth/telegram.ts';

const vars = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
const token = /^TELEGRAM_BOT_TOKEN=(.+)$/m.exec(vars)?.[1]?.trim();
if (!token)
  throw new Error('TELEGRAM_BOT_TOKEN is missing from .dev.vars (copy .dev.vars.example)');

const [authUrl, id = '100000001'] = process.argv.slice(2);
if (!authUrl)
  throw new Error('Pass the data-auth-url from /en/sign-in/telegram (see the top of this file)');
const url = new URL(authUrl);
if (!url.searchParams.get('state'))
  throw new Error('That URL has no state: copy it from the page again');
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Local site only');

const signed = await signLoginWidget(
  { id, auth_date: String(Math.floor(Date.now() / 1000)) },
  token,
);
for (const [key, value] of signed) url.searchParams.set(key, value);
console.log(url.href);
