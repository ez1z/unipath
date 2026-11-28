/**
 * Local stand-in for opening Clavis from the Telegram bot. Telegram would open
 * `/tg` with signed launch data in the URL hash; this prints such a link,
 * signed with the made-up TELEGRAM_BOT_TOKEN in .dev.vars. Never use a real token.
 *
 *   pnpm exec node scripts/dev-telegram-webapp.ts [telegram-id] [language] [light|dark]
 *   e.g. pnpm exec node scripts/dev-telegram-webapp.ts 100000002 ru dark
 *
 * Open the link (with `pnpm preview` running) in a private window: you land on
 * /ru signed in, in Telegram's dark theme. A plain browser isn't inside
 * Telegram, so the back button and share sheet only show up in the real app
 * (see docs/manual-checks.md, M6).
 */
import { readFileSync } from 'node:fs';
import { signInitData } from '../src/lib/auth/telegram.ts';

const vars = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
const token = /^TELEGRAM_BOT_TOKEN=(.+)$/m.exec(vars)?.[1]?.trim();
if (!token)
  throw new Error('TELEGRAM_BOT_TOKEN is missing from .dev.vars (copy .dev.vars.example)');

const [id = '100000002', language = 'ru', scheme = 'light'] = process.argv.slice(2);
if (!/^\d{1,20}$/.test(id)) throw new Error('The Telegram id must be a number');

// Telegram's own default colours for each scheme (data for the stand-in, not Clavis styling).
const themes: Record<string, Record<string, string>> = {
  light: { bg_color: '#ffffff', text_color: '#000000', secondary_bg_color: '#f0f0f0' },
  dark: { bg_color: '#17212b', text_color: '#f5f5f5', secondary_bg_color: '#232e3c' },
};
const theme = themes[scheme] ?? themes['light'];

const initData = await signInitData(
  {
    user: JSON.stringify({ id: Number(id), first_name: 'Dev', language_code: language }),
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'dev-stand-in',
  },
  token,
);
const hash = new URLSearchParams({
  tgWebAppData: initData,
  tgWebAppVersion: '8.0',
  tgWebAppPlatform: 'tdesktop',
  tgWebAppThemeParams: JSON.stringify(theme),
});
console.log(`http://localhost:4321/tg#${hash.toString()}`);
