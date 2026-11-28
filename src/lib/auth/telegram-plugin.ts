/**
 * "Continue with Telegram" on the website. The Login Widget sends the browser to
 * `GET /api/auth/telegram/callback?state=…&next=…&id=…&auth_date=…&hash=…`;
 * this checks the one-time state, the signature and its age, then signs in or
 * links Telegram to the signed-in user.
 *
 * Telegram users get a placeholder address on the reserved `.invalid` domain,
 * because Better Auth needs a unique email. Nothing is ever sent to it.
 */
import type { BetterAuthPlugin } from 'better-auth';
import { createAuthEndpoint, getSessionFromCtx } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import * as z from 'zod';
import { safeNextPath } from './next.ts';
import { verifyLoginWidget } from './telegram.ts';

export const TELEGRAM_PROVIDER = 'telegram';
const PLACEHOLDER_DOMAIN = 'telegram.invalid';

/** The fields the Login Widget signs. Anything else in the query is ours (next, error). */
export const WIDGET_FIELDS = [
  'id',
  'first_name',
  'last_name',
  'username',
  'photo_url',
  'auth_date',
  'hash',
] as const;

export function placeholderEmail(telegramId: string): string {
  return `tg-${telegramId}@${PLACEHOLDER_DOMAIN}`;
}

/** True for addresses Clavis made up and must never email. */
export function isPlaceholderEmail(email: string): boolean {
  return email.toLowerCase().endsWith('.invalid');
}

/**
 * The callback is a plain GET, so anyone can send a browser to it with their own
 * signed Telegram data. To make sure the browser came from our Telegram page,
 * that page sets a random one-time `state` in an httpOnly cookie and in the
 * widget's return URL; the callback goes on only when the two match. A link
 * built by someone else can't know this browser's cookie, so it can neither
 * link their Telegram to a signed-in student nor sign a student into theirs.
 */
export const TELEGRAM_STATE_COOKIE = 'clavis_tg_state';
export const TELEGRAM_STATE_PATH = '/api/auth/telegram';
export const TELEGRAM_STATE_SECONDS = 10 * 60;

/** Login Widget data is taken once, and only within an hour of Telegram signing it. */
export const TELEGRAM_WIDGET_MAX_AGE_SECONDS = 60 * 60;

export function newTelegramState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function sameState(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b || a.length !== b.length || a.length < 32) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Remembers a used Login Widget hash; false if it was used before. */
export type MarkUsed = (key: string, ttlSeconds: number) => Promise<boolean>;

export type TelegramError = 'telegram-failed' | 'telegram-expired' | 'telegram-taken';

/** Adds `?error=` to a safe path. */
function withError(path: string, error: TelegramError): string {
  const url = new URL(path, 'http://x');
  url.searchParams.set('error', error);
  return `${url.pathname}${url.search}`;
}

export const telegramPlugin = ({
  botToken,
  markUsed,
}: {
  botToken?: string | undefined;
  markUsed: MarkUsed;
}) =>
  ({
    id: 'telegram',
    endpoints: {
      telegramCallback: createAuthEndpoint(
        '/telegram/callback',
        {
          method: 'GET',
          query: z.record(z.string(), z.string()),
        },
        async (ctx) => {
          const query = ctx.query;
          const next = safeNextPath(query['next']);
          const failTo = safeNextPath(query['fail']) ?? next ?? '/';

          // One try per visit to the Telegram page: clear the state whatever happens.
          const state = ctx.getCookie(TELEGRAM_STATE_COOKIE);
          ctx.setCookie(TELEGRAM_STATE_COOKIE, '', {
            path: TELEGRAM_STATE_PATH,
            maxAge: 0,
            httpOnly: true,
            sameSite: 'lax',
            secure: ctx.context.baseURL.startsWith('https://'),
          });
          if (!sameState(state, query['state'])) {
            throw ctx.redirect(withError(failTo, 'telegram-failed'));
          }

          const signed = new URLSearchParams();
          for (const key of WIDGET_FIELDS) {
            const value = query[key];
            if (value !== undefined) signed.set(key, value);
          }
          const result = await verifyLoginWidget(signed, botToken);
          if (!result.ok) {
            const error = result.reason === 'expired' ? 'telegram-expired' : 'telegram-failed';
            throw ctx.redirect(withError(failTo, error));
          }
          const age = Math.floor(Date.now() / 1000) - result.authDate;
          if (age > TELEGRAM_WIDGET_MAX_AGE_SECONDS) {
            throw ctx.redirect(withError(failTo, 'telegram-expired'));
          }
          // Signed data left in browser history must not sign in a second time.
          const fresh = await markUsed(
            `tg-used:${signed.get('hash')?.toLowerCase() ?? ''}`,
            TELEGRAM_WIDGET_MAX_AGE_SECONDS + 5 * 60,
          );
          if (!fresh) throw ctx.redirect(withError(failTo, 'telegram-expired'));

          const adapter = ctx.context.internalAdapter;
          const key = { providerId: TELEGRAM_PROVIDER, accountId: result.telegramId };
          let owner = await adapter.findAccountOwnerByKey(key);
          if (owner?.kind === 'orphaned') {
            await adapter.deleteAccount(owner.account.id);
            owner = null;
          }

          const current = await getSessionFromCtx(ctx);
          if (current) {
            // Linking from Profile, or signing in again while signed in.
            if (owner && owner.user.id !== current.user.id) {
              throw ctx.redirect(withError(failTo, 'telegram-taken'));
            }
            if (!owner) {
              await adapter.linkAccount({ ...key, userId: current.user.id });
            }
            throw ctx.redirect(next ?? '/');
          }

          let user = owner?.user;
          if (!user) {
            user = await adapter.createUser(
              { email: placeholderEmail(result.telegramId), name: '', emailVerified: false },
              { method: TELEGRAM_PROVIDER },
            );
            await adapter.linkAccount({ ...key, userId: user.id });
          }
          const session = await adapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          throw ctx.redirect(next ?? '/');
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
