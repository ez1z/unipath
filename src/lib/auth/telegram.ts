/**
 * Telegram sign-in checks, done on the server with the bot token.
 *
 * - Login Widget (website): the data-check-string is signed with HMAC-SHA256,
 *   keyed with SHA-256(bot token).
 *   https://core.telegram.org/widgets/login#checking-authorization
 * - Mini App `initData` (M6): the same string, keyed with
 *   HMAC-SHA256("WebAppData", bot token).
 *   https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Both reject data older than 24 hours. Only the Telegram user id is kept:
 * names, usernames and photos are never stored (SPEC: store the minimum).
 */

import { isLang, type Lang } from '../../i18n/config.ts';

/** Login data older than this is refused. */
export const TELEGRAM_MAX_AGE_SECONDS = 24 * 60 * 60;
/** A little clock skew between Telegram and the Worker is fine; a date far ahead is not. */
const MAX_FUTURE_SKEW_SECONDS = 5 * 60;

export type TelegramCheck =
  | { ok: true; telegramId: string; authDate: number }
  | { ok: false; reason: 'missing' | 'bad-hash' | 'expired' | 'no-token' | 'rate' };

const encoder = new TextEncoder();

async function hmac(key: BufferSource, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compares two hex strings without stopping at the first difference. */
function sameHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Every field except `hash`, sorted by key, as `key=value` lines. */
export function dataCheckString(fields: Iterable<[string, string]>): string {
  return [...fields]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

async function widgetKey(botToken: string) {
  return crypto.subtle.digest('SHA-256', encoder.encode(botToken));
}

async function webAppKey(botToken: string) {
  return hmac(encoder.encode('WebAppData'), botToken);
}

async function check(
  fields: [string, string][],
  key: ArrayBuffer,
  telegramIdOf: (fields: Map<string, string>) => string | null,
  nowSeconds: number,
): Promise<TelegramCheck> {
  const map = new Map(fields);
  const hash = map.get('hash');
  const authDate = Number(map.get('auth_date'));
  const telegramId = telegramIdOf(map);
  if (!hash || !Number.isInteger(authDate) || !telegramId) return { ok: false, reason: 'missing' };

  const expected = toHex(await hmac(key, dataCheckString(fields)));
  if (!sameHex(expected, hash.toLowerCase())) return { ok: false, reason: 'bad-hash' };

  const age = nowSeconds - authDate;
  if (age > TELEGRAM_MAX_AGE_SECONDS || age < -MAX_FUTURE_SKEW_SECONDS) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, telegramId, authDate };
}

const numericId = (value: string | undefined) =>
  value !== undefined && /^\d{1,20}$/.test(value) ? value : null;

/** The query the Login Widget sends to `data-auth-url` (id, auth_date, hash, names…). */
export async function verifyLoginWidget(
  params: URLSearchParams,
  botToken: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<TelegramCheck> {
  if (!botToken) return { ok: false, reason: 'no-token' };
  return check(
    [...params],
    await widgetKey(botToken),
    (map) => numericId(map.get('id')),
    nowSeconds,
  );
}

/** `Telegram.WebApp.initData`, a query string with `user` as JSON. */
export async function verifyInitData(
  initData: string,
  botToken: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<TelegramCheck & { languageCode?: string | null }> {
  if (!botToken) return { ok: false, reason: 'no-token' };
  let languageCode: string | null = null;
  const result = await check(
    [...new URLSearchParams(initData)],
    await webAppKey(botToken),
    (map) => {
      try {
        const user = JSON.parse(map.get('user') ?? 'null') as {
          id?: unknown;
          language_code?: unknown;
        } | null;
        if (typeof user?.language_code === 'string') languageCode = user.language_code;
        return typeof user?.id === 'number' ? numericId(String(user.id)) : null;
      } catch {
        return null;
      }
    },
    nowSeconds,
  );
  return result.ok ? { ...result, languageCode } : result;
}

/**
 * Clavis's language for a Telegram `language_code` (an IETF tag such as
 * "ru" or "en-US"), or null when Clavis has no version in it.
 */
export function langFromTelegram(code: string | null | undefined): Lang | null {
  const base = code?.trim().toLowerCase().split(/[-_]/)[0];
  return isLang(base) ? base : null;
}

/**
 * Signs fields the way Telegram does. For tests and the local stand-in only: the
 * real Telegram signs on its side, with a token Clavis never shares.
 */
export async function signLoginWidget(
  fields: Record<string, string>,
  botToken: string,
): Promise<URLSearchParams> {
  const entries = Object.entries(fields);
  const hash = toHex(await hmac(await widgetKey(botToken), dataCheckString(entries)));
  return new URLSearchParams([...entries, ['hash', hash]]);
}

export async function signInitData(
  fields: Record<string, string>,
  botToken: string,
): Promise<string> {
  const entries = Object.entries(fields);
  const hash = toHex(await hmac(await webAppKey(botToken), dataCheckString(entries)));
  return new URLSearchParams([...entries, ['hash', hash]]).toString();
}
