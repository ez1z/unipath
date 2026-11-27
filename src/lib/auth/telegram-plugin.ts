/**
 * "Continue with Telegram" on the website. The Login Widget sends the browser to
 * `GET /api/auth/telegram/callback?id=…&auth_date=…&hash=…&next=/tk/auth/continue…`;
 * this checks the signature, then signs in or links Telegram to the signed-in user.
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

export type TelegramError = 'telegram-failed' | 'telegram-expired' | 'telegram-taken';

/** Adds `?error=` to a safe path. */
function withError(path: string, error: TelegramError): string {
  const url = new URL(path, 'http://x');
  url.searchParams.set('error', error);
  return `${url.pathname}${url.search}`;
}

export const telegramPlugin = ({ botToken }: { botToken?: string | undefined }) =>
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
