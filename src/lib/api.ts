/**
 * Shared steps of the write endpoints. Each one takes a plain HTML form (works
 * without JavaScript, answers with a redirect) or JSON from an island (answers
 * with JSON). Cross-site form posts are refused by Astro's origin check
 * (`security.checkOrigin`, on by default); JSON can't be sent cross-site
 * without a CORS preflight, which these endpoints never allow.
 */
import { env } from 'cloudflare:workers';
import { isLang, resolveLang, type Lang } from '../i18n/config.ts';
import { safeNextPath } from './auth/next.ts';
import { getSignedIn, redirectWithCookies, type SignedIn } from './auth/server.ts';
import { signInPath } from './auth/urls.ts';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: NO_STORE });

export interface WriteRequest {
  isForm: boolean;
  input: Record<string, unknown>;
  lang: Lang;
  /** Where a form goes back to (a same-site path). */
  back: string;
  /** Set-Cookie headers from a refreshed session, to pass on. */
  cookies: Headers;
}

/** Reads the body; null when it isn't valid form data or JSON. */
export async function readWrite(request: Request): Promise<WriteRequest | null> {
  const isForm = !(request.headers.get('Content-Type') ?? '').includes('application/json');
  let input: Record<string, unknown>;
  try {
    input = isForm
      ? Object.fromEntries(await request.formData())
      : ((await request.json()) as Record<string, unknown>);
  } catch {
    return null;
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const lang = isLang(input['lang']) ? input['lang'] : resolveLang(null);
  return {
    isForm,
    input,
    lang,
    back: safeNextPath(input['back']) ?? `/${lang}/my`,
    cookies: new Headers(),
  };
}

/** Adds `?error=` to a same-site path. */
export function withError(path: string, error: string): string {
  const url = new URL(path, 'http://x');
  url.searchParams.set('error', error);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The answer to a write: a redirect for forms, JSON for islands. */
export function reply(
  req: WriteRequest,
  result:
    | { ok: true; body?: Record<string, unknown>; to?: string | undefined }
    | { ok: false; error: string; status: number },
): Response {
  const cookies = req.cookies.getSetCookie();
  if (req.isForm) {
    const to = result.ok ? (result.to ?? req.back) : withError(req.back, result.error);
    return redirectWithCookies(to, cookies);
  }
  const response = result.ok
    ? json({ ok: true, ...result.body })
    : json({ error: result.error }, result.status);
  for (const cookie of cookies) response.headers.append('Set-Cookie', cookie);
  return response;
}

export type Gate = { ok: true; signedIn: SignedIn } | { ok: false; response: Response };

/**
 * Signed in and under the per-user write limit. Signed out: a form goes to
 * sign-in (with `action` to finish afterwards), JSON gets 401.
 */
export async function requireWriter(
  request: Request,
  req: WriteRequest,
  action: string | null = null,
): Promise<Gate> {
  const signedIn = await getSignedIn(request.headers, req.cookies);
  if (!signedIn) {
    return {
      ok: false,
      response: req.isForm
        ? redirectWithCookies(signInPath(req.lang, { next: req.back, action }), [])
        : json({ error: 'auth' }, 401),
    };
  }
  const limit = await env.WRITE_LIMITER.limit({ key: `write:${signedIn.user.id}` });
  if (!limit.success) {
    return { ok: false, response: reply(req, { ok: false, error: 'rate', status: 429 }) };
  }
  return { ok: true, signedIn };
}
