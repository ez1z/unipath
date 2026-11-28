/**
 * Better Auth for Clavis: email code first, then Telegram (Login Widget) and
 * Google. One user can link all three. Sessions last 30 days in httpOnly
 * cookies (Secure on https).
 *
 * `createAuth` takes everything it needs as arguments, so the Worker
 * (lib/auth/server.ts) and the unit tests (local D1, fake keys) build it the
 * same way.
 */
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins/email-otp';
import type { Db } from '../db/client.ts';
import * as schema from '../db/schema.ts';
import { resolveLang, type Lang } from '../../i18n/config.ts';
import { signInCodeMail, type Mailer } from '../email.ts';
import { telegramPlugin, type MarkUsed } from './telegram-plugin.ts';

export const SESSION_DAYS = 30;
export const CODE_LENGTH = 6;
export const CODE_MINUTES = 10;
/** Wrong codes allowed before the code is thrown away and a new one is needed. */
export const CODE_ATTEMPTS = 5;
/** Cookie names start with this: `clavis.session_token`. */
export const COOKIE_PREFIX = 'clavis';
/** Islands and server calls send the page language here, so the code email is in it. */
export const LANG_HEADER = 'X-Clavis-Lang';

export interface AuthConfig {
  db: Db;
  /** e.g. https://clavis.example; also the only trusted origin. */
  siteUrl: string;
  secret: string;
  mailer: Mailer;
  telegramBotToken?: string | undefined;
  /** Remembers used Telegram login data (KV in the Worker), so it can't be replayed. */
  telegramMarkUsed: MarkUsed;
  google?: { clientId: string; clientSecret: string } | undefined;
}

export function createAuth(config: AuthConfig) {
  const { db, siteUrl, mailer } = config;
  const google = config.google;

  const options = {
    appName: 'Clavis',
    baseURL: siteUrl,
    basePath: '/api/auth',
    secret: config.secret,
    trustedOrigins: [siteUrl],
    telemetry: { enabled: false },
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      // D1 has no interactive transactions.
      transaction: false,
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    user: {
      additionalFields: {
        // Set by hand in the database for admins; never from a request.
        role: { type: 'string', required: false, input: false, defaultValue: 'student' },
      },
    },
    session: {
      expiresIn: SESSION_DAYS * 24 * 60 * 60,
      // Refresh the expiry at most once a day of use.
      updateAge: 24 * 60 * 60,
    },
    account: {
      accountLinking: {
        enabled: true,
        // Google confirms the email, so it may join an email-code account with the same address.
        trustedProviders: ['google', 'email-otp', 'telegram'],
        allowDifferentEmails: true,
      },
    },
    advanced: {
      // Explicit, so the check also runs under test (Better Auth skips it there by default).
      disableOriginCheck: false,
      // Store the minimum: sessions don't keep the IP address. Sign-in attempts are
      // limited per IP by the Worker's AUTH_LIMITER instead.
      ipAddress: { disableIpTracking: true },
      cookiePrefix: COOKIE_PREFIX,
      useSecureCookies: siteUrl.startsWith('https://'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
    },
    socialProviders: google
      ? {
          google: {
            clientId: google.clientId,
            clientSecret: google.clientSecret,
            prompt: 'select_account',
            // Store the minimum: no real name, no photo.
            mapProfileToUser: () => ({ name: '', image: undefined }),
          },
        }
      : {},
    plugins: [
      emailOTP({
        otpLength: CODE_LENGTH,
        expiresIn: CODE_MINUTES * 60,
        allowedAttempts: CODE_ATTEMPTS,
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp, type }, ctx) {
          if (type !== 'sign-in' && type !== 'change-email') return;
          const lang: Lang = resolveLang(ctx?.headers?.get(LANG_HEADER));
          await mailer.send(signInCodeMail(lang, email, otp));
        },
        changeEmail: { enabled: true, verifyCurrentEmail: false },
      }),
      telegramPlugin({ botToken: config.telegramBotToken, markUsed: config.telegramMarkUsed }),
    ],
  } satisfies BetterAuthOptions;

  return betterAuth(options);
}

export type Auth = ReturnType<typeof createAuth>;
