/**
 * Auth in the Worker: one Better Auth instance per isolate, built from the
 * bindings and secrets in `env`. Pages and endpoints call `getSignedIn`.
 */
import { isAPIError } from 'better-auth/api';
import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import * as z from 'zod';
import type { Lang } from '../../i18n/config.ts';
import { account } from '../db/schema.ts';
import {
  cloudflareMailer,
  consoleMailer,
  emailAvailable,
  type Mailer,
  type SendEmailBinding,
} from '../email.ts';
import { clientIp, getDb } from '../server.ts';
import { CODE_LENGTH, createAuth, LANG_HEADER, type Auth } from './auth.ts';
import { isPlaceholderEmail, type MarkUsed } from './telegram-plugin.ts';
import { verifyInitData, type TelegramCheck } from './telegram.ts';
import type { TelegramSender } from '../reminders.ts';
import { botSender, consoleTelegramSender } from '../telegram-bot.ts';

/** `env` with the optional parts typed loosely (the email binding exists only in production). */
const vars = env as unknown as Record<string, string | undefined> & {
  EMAIL?: SendEmailBinding;
};

export function siteUrl(): string {
  return (vars['SITE_URL'] ?? 'http://localhost:4321').replace(/\/$/, '');
}

const isLocalSite = () => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(siteUrl());

/** Tests read sign-in codes from the local mailbox; never on a real domain. */
export function devMailboxEnabled(): boolean {
  return vars['DEV_MAILBOX'] === '1' && isLocalSite() && !vars.EMAIL;
}

/**
 * Whether email codes and email reminders are offered at all. Off unless a
 * sender is set up: production has none for now (Cloudflare Email needs the
 * paid Workers plan), so students sign in with Telegram or Google and get
 * reminders by Telegram. On a local site the test mailbox counts as a sender.
 * Adding the EMAIL binding and EMAIL_FROM (DEPLOY.md) turns it back on.
 */
export function emailEnabled(): boolean {
  return emailAvailable({
    binding: Boolean(vars.EMAIL),
    from: vars['EMAIL_FROM'],
    devMailbox: devMailboxEnabled(),
  });
}

/** Cloudflare Email in production; the console (and dev mailbox) on a local site. */
export function getMailer(): Mailer {
  if (vars.EMAIL && vars['EMAIL_FROM']) return cloudflareMailer(vars.EMAIL, vars['EMAIL_FROM']);
  if (isLocalSite()) return consoleMailer(devMailboxEnabled() ? env.KV : null);
  // On a real domain without the email binding, codes must not end up in the logs.
  return {
    send: () => Promise.reject(new Error('Email is not set up: add the EMAIL binding (DEPLOY.md)')),
  };
}

/**
 * The bot that sends Telegram reminders: the real Bot API on a real domain
 * with a token, the console (and dev mailbox) on a local site, else none
 * (Telegram reminders then wait, unsent and unlogged, until it is set up).
 */
export function getTelegramSender(): TelegramSender | null {
  if (isLocalSite()) return consoleTelegramSender(devMailboxEnabled() ? env.KV : null);
  const token = vars['TELEGRAM_BOT_TOKEN'];
  return token ? botSender(token) : null;
}

export function googleEnabled(): boolean {
  return Boolean(vars['GOOGLE_CLIENT_ID'] && vars['GOOGLE_CLIENT_SECRET']);
}

export function telegramBotUsername(): string | null {
  return vars['TELEGRAM_BOT_USERNAME'] || null;
}

/** KV is eventually consistent, so this stops replays from history, not a race of two tabs. */
const markUsedInKv: MarkUsed = async (key, ttlSeconds) => {
  if ((await env.KV.get(key)) !== null) return false;
  await env.KV.put(key, '1', { expirationTtl: Math.max(60, ttlSeconds) });
  return true;
};

let auth: Auth | null = null;

export function getAuth(): Auth {
  if (auth) return auth;
  const secret = vars['BETTER_AUTH_SECRET'];
  if (!secret) throw new Error('BETTER_AUTH_SECRET is not set (see .dev.vars.example)');
  auth = createAuth({
    db: getDb(),
    siteUrl: siteUrl(),
    secret,
    mailer: getMailer(),
    telegramBotToken: vars['TELEGRAM_BOT_TOKEN'],
    telegramMarkUsed: markUsedInKv,
    google: googleEnabled()
      ? {
          clientId: vars['GOOGLE_CLIENT_ID'] ?? '',
          clientSecret: vars['GOOGLE_CLIENT_SECRET'] ?? '',
        }
      : undefined,
  });
  return auth;
}

export type SignedIn = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;

/**
 * The signed-in user and session, or null. Pass the response headers so a
 * session that was refreshed (once a day of use) also gets a fresh cookie.
 */
export async function getSignedIn(
  requestHeaders: Headers,
  responseHeaders?: Headers,
): Promise<SignedIn | null> {
  const { response, headers } = await getAuth().api.getSession({
    headers: requestHeaders,
    returnHeaders: true,
  });
  if (responseHeaders) {
    for (const cookie of headers.getSetCookie()) responseHeaders.append('Set-Cookie', cookie);
  }
  return response;
}

// ---------------------------------------------------------------------------
// Email code steps for the no-JavaScript forms (sign-in page, Profile)
// ---------------------------------------------------------------------------

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254))
  .refine((email) => !isPlaceholderEmail(email));

export const codeSchema = z
  .string()
  .trim()
  .length(CODE_LENGTH)
  .regex(/^[0-9]+$/);

export type CodeError = 'email' | 'code' | 'rate' | 'taken' | 'generic';
export type CodeResult = { ok: true; cookies: string[] } | { ok: false; error: CodeError };

/** Per-IP limit on sending and trying codes (the same limiter as /api/auth). */
export async function authAllowed(request: Request): Promise<boolean> {
  return (await env.AUTH_LIMITER.limit({ key: `auth:${clientIp(request)}` })).success;
}

/**
 * The Mini App signs in on every open, and many students share a few IP
 * addresses (VPNs, mobile carriers), so `/tg` limits per Telegram user, after
 * the signature check, instead of per IP.
 */
export async function checkMiniApp(initData: string): Promise<TelegramCheck> {
  const result = await verifyInitData(initData, vars['TELEGRAM_BOT_TOKEN']);
  if (!result.ok) return result;
  const limit = await env.AUTH_LIMITER.limit({ key: `tg:${result.telegramId}` });
  return limit.success ? result : { ok: false, reason: 'rate' };
}

function headersFor(request: Request, lang: Lang): Headers {
  const headers = new Headers(request.headers);
  headers.set(LANG_HEADER, lang);
  return headers;
}

function errorOf(error: unknown): CodeError {
  if (!isAPIError(error)) throw error;
  const code = (error.body as { code?: string } | undefined)?.code ?? '';
  // INVALID_OTP, OTP_EXPIRED, TOO_MANY_ATTEMPTS (that code is used up): ask for a new one.
  if (/OTP|ATTEMPT/i.test(code)) return 'code';
  if (/RATE|TOO_MANY_REQUESTS/i.test(code) || error.statusCode === 429) return 'rate';
  if (/EXIST|TAKEN|IN_USE/i.test(code)) return 'taken';
  return 'generic';
}

/** Sends a sign-in code (or, with `change`, a code to add this address to the account). */
export async function sendCode(
  request: Request,
  lang: Lang,
  rawEmail: unknown,
  change = false,
): Promise<{ ok: true; email: string } | { ok: false; error: CodeError }> {
  if (!emailEnabled()) return { ok: false, error: 'generic' };
  const email = emailSchema.safeParse(rawEmail);
  if (!email.success) return { ok: false, error: 'email' };
  if (!(await authAllowed(request))) return { ok: false, error: 'rate' };
  try {
    const headers = headersFor(request, lang);
    if (change) {
      await getAuth().api.requestEmailChangeEmailOTP({ body: { newEmail: email.data }, headers });
    } else {
      await getAuth().api.sendVerificationOTP({
        body: { email: email.data, type: 'sign-in' },
        headers,
      });
    }
    return { ok: true, email: email.data };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

/** Signs in with an email code; the cookies go on the redirect. */
export async function signInWithCode(
  request: Request,
  lang: Lang,
  rawEmail: unknown,
  rawCode: unknown,
): Promise<CodeResult> {
  if (!emailEnabled()) return { ok: false, error: 'generic' };
  const email = emailSchema.safeParse(rawEmail);
  if (!email.success) return { ok: false, error: 'email' };
  const otp = codeSchema.safeParse(rawCode);
  if (!otp.success) return { ok: false, error: 'code' };
  if (!(await authAllowed(request))) return { ok: false, error: 'rate' };
  try {
    const { headers } = await getAuth().api.signInEmailOTP({
      body: { email: email.data, otp: otp.data },
      headers: headersFor(request, lang),
      returnHeaders: true,
    });
    return { ok: true, cookies: headers.getSetCookie() };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

/** Confirms a code sent to a new address, making it the account's email. */
export async function confirmEmailChange(
  request: Request,
  lang: Lang,
  rawEmail: unknown,
  rawCode: unknown,
): Promise<CodeResult> {
  if (!emailEnabled()) return { ok: false, error: 'generic' };
  const email = emailSchema.safeParse(rawEmail);
  if (!email.success) return { ok: false, error: 'email' };
  const otp = codeSchema.safeParse(rawCode);
  if (!otp.success) return { ok: false, error: 'code' };
  if (!(await authAllowed(request))) return { ok: false, error: 'rate' };
  try {
    const { headers } = await getAuth().api.changeEmailEmailOTP({
      body: { newEmail: email.data, otp: otp.data },
      headers: headersFor(request, lang),
      returnHeaders: true,
    });
    return { ok: true, cookies: headers.getSetCookie() };
  } catch (error) {
    return { ok: false, error: errorOf(error) };
  }
}

/** Cookies that sign this browser out. */
export async function signOutCookies(request: Request): Promise<string[]> {
  try {
    const { headers } = await getAuth().api.signOut({
      headers: request.headers,
      returnHeaders: true,
    });
    return headers.getSetCookie();
  } catch {
    return [];
  }
}

/** Sign-in methods linked to the user: 'telegram', 'google', plus 'email' for a real address. */
export async function linkedMethods(signedIn: SignedIn): Promise<Set<string>> {
  const rows = await getDb()
    .select({ providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, signedIn.user.id));
  const methods = new Set(rows.map((r) => r.providerId));
  if (!isPlaceholderEmail(signedIn.user.email)) methods.add('email');
  return methods;
}

/** A redirect that also sets cookies. */
export function redirectWithCookies(location: string, cookies: string[], status = 303): Response {
  const headers = new Headers({ Location: location, 'Cache-Control': 'private, no-store' });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status, headers });
}
