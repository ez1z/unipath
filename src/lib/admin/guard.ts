/**
 * Who may open /admin: a signed-in user whose `role` is `admin`, set by hand
 * in the database (`scripts/make-admin.ts`). Signed out: the sign-in page,
 * then back. Anyone else: a plain 404, so the admin area isn't advertised.
 */
import { eq } from 'drizzle-orm';
import { LANG_COOKIE, resolveLang, type Lang } from '../../i18n/config.ts';
import { getSignedIn, type SignedIn } from '../auth/server.ts';
import { signInPath } from '../auth/urls.ts';
import { profiles } from '../db/schema.ts';
import { getDb } from '../server.ts';
import { isAdmin } from './roles.ts';

export { isAdmin };

export interface AdminContext {
  signedIn: SignedIn;
  adminId: string;
  /** The admin area speaks the admin's saved site language (Profile), else the cookie's. */
  lang: Lang;
}

export function adminLang(cookieHeader: string | null): Lang {
  const match = new RegExp(`(?:^|; )${LANG_COOKIE}=([a-z]{2})(?:;|$)`).exec(cookieHeader ?? '');
  return resolveLang(match?.[1]);
}

/** An AdminContext, or the Response to send instead (redirect to sign-in, or 404). */
export async function requireAdmin(
  request: Request,
  responseHeaders?: Headers,
): Promise<AdminContext | Response> {
  const lang = adminLang(request.headers.get('Cookie'));
  const signedIn = await getSignedIn(request.headers, responseHeaders);
  if (!signedIn) {
    const url = new URL(request.url);
    return new Response(null, {
      status: 303,
      headers: {
        Location: signInPath(lang, { next: `${url.pathname}${url.search}` }),
        'Cache-Control': 'private, no-store',
      },
    });
  }
  if (!isAdmin(signedIn)) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'private, no-store', 'Content-Type': 'text/plain' },
    });
  }
  // The admin's saved site language (Profile), else the language cookie.
  const [profile] = await getDb()
    .select({ lang: profiles.preferredLang })
    .from(profiles)
    .where(eq(profiles.userId, signedIn.user.id))
    .limit(1);
  return { signedIn, adminId: signedIn.user.id, lang: profile?.lang ?? lang };
}
