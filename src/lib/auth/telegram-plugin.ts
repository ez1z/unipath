/**
 * Telegram sign-in, two ways:
 *
 * - Website: "Continue with Telegram". The Login Widget sends the browser to
 *   `GET /api/auth/telegram/callback?state=…&next=…&id=…&auth_date=…&hash=…`;
 *   this checks the one-time state, the signature and its age, then signs in or
 *   links Telegram to the signed-in user.
 * - Mini App: `auth.api.telegramWebApp` with the Mini App's `initData`, a
 *   silent sign-in. Server-only (no URL): `/tg` calls it.
 *
 * Telegram users get a placeholder address on the reserved `.invalid` domain,
 * because Better Auth needs a unique email. Nothing is ever sent to it.
 */
import type { BetterAuthPlugin } from 'better-auth';
import { createAuthEndpoint, getSessionFromCtx } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import * as z from 'zod';
import { safeNextPath } from './next.ts';
import { verifyInitData, verifyLoginWidget } from './telegram.ts';

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
          const owner = await ownerOf(adapter, result.telegramId);

          const current = await getSessionFromCtx(ctx);
          if (current) {
            // Linking from Profile, or signing in again while signed in.
            if (owner && owner.id !== current.user.id) {
              throw ctx.redirect(withError(failTo, 'telegram-taken'));
            }
            if (!owner) {
              await adapter.linkAccount({
                ...telegramKey(result.telegramId),
                userId: current.user.id,
              });
            }
            throw ctx.redirect(next ?? '/');
          }

          const user = owner ?? (await createTelegramUser(adapter, result.telegramId));
          const session = await adapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          throw ctx.redirect(next ?? '/');
        },
      ),

      /**
       * Silent sign-in inside the Mini App (called by `/tg`). The data is
       * `Telegram.WebApp.initData`, checked with the bot token and refused
       * after 24 hours (SPEC). Inside Telegram, the Telegram account is who
       * the student is: a session for anyone else is replaced, and nothing is
       * linked silently. The answer says whether the user is new, so `/tg`
       * can take the language from Telegram only the first time.
       */
      telegramWebApp: createAuthEndpoint(
        '/telegram/webapp',
        {
          method: 'POST',
          body: z.object({ initData: z.string().min(1).max(INIT_DATA_MAX_LENGTH) }),
          // Not on /api/auth: the only way in is /tg, which checks the origin and
          // limits per Telegram user before calling this.
          metadata: { SERVER_ONLY: true },
        },
        async (ctx) => {
          const result = await verifyInitData(ctx.body.initData, botToken);
          if (!result.ok) {
            ctx.setStatus(401);
            return ctx.json({
              ok: false as const,
              error: result.reason === 'expired' ? ('expired' as const) : ('failed' as const),
            });
          }

          const adapter = ctx.context.internalAdapter;
          const owner = await ownerOf(adapter, result.telegramId);
          const current = await getSessionFromCtx(ctx);
          if (owner && current?.user.id === owner.id) {
            return ctx.json({
              ok: true as const,
              userId: owner.id,
              created: false,
              languageCode: result.languageCode ?? null,
            });
          }

          const user = owner ?? (await createTelegramUser(adapter, result.telegramId));
          if (current) await adapter.deleteSession(current.session.token);
          const session = await adapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          return ctx.json({
            ok: true as const,
            userId: user.id,
            created: owner === null,
            languageCode: result.languageCode ?? null,
          });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;

/** `initData` is a few hundred bytes; Telegram keeps it well under this. */
export const INIT_DATA_MAX_LENGTH = 4096;

type InternalAdapter = Parameters<typeof getSessionFromCtx>[0]['context']['internalAdapter'];

const telegramKey = (telegramId: string) => ({
  providerId: TELEGRAM_PROVIDER,
  accountId: telegramId,
});

/** The user this Telegram account belongs to, if any (a link left by a deleted user is cleared). */
async function ownerOf(adapter: InternalAdapter, telegramId: string) {
  const owner = await adapter.findAccountOwnerByKey(telegramKey(telegramId));
  if (owner?.kind === 'orphaned') {
    await adapter.deleteAccount(owner.account.id);
    return null;
  }
  return owner?.user ?? null;
}

async function createTelegramUser(adapter: InternalAdapter, telegramId: string) {
  const user = await adapter.createUser(
    { email: placeholderEmail(telegramId), name: '', emailVerified: false },
    { method: TELEGRAM_PROVIDER },
  );
  await adapter.linkAccount({ ...telegramKey(telegramId), userId: user.id });
  return user;
}
