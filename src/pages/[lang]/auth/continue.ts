import type { APIRoute } from 'astro';
import { isLang } from '../../../i18n/config';
import { ensureProfile, parsePendingAction, runPendingAction } from '../../../lib/account';
import { safeNextPath } from '../../../lib/auth/next';
import { getSignedIn, redirectWithCookies } from '../../../lib/auth/server';
import { myPath, signInPath } from '../../../lib/auth/urls';
import { getDb } from '../../../lib/server';

export const prerender = false;

/**
 * Every sign-in method ends here: make sure the profile exists (in the language
 * the student signed in from), finish the action they tried, and go back.
 *
 * The action only runs for a session made in the last few minutes, so a link
 * to this page can't make someone who is already signed in save something.
 */
const FRESH_SESSION_MS = 10 * 60 * 1000;

export const GET: APIRoute = async ({ params, request, url }) => {
  const lang = params['lang'];
  if (!isLang(lang)) return new Response(null, { status: 404 });
  const next = safeNextPath(url.searchParams.get('next'));
  const rawAction = url.searchParams.get('action');
  const action = parsePendingAction(rawAction);

  const cookies = new Headers();
  const signedIn = await getSignedIn(request.headers, cookies);
  if (!signedIn) {
    return redirectWithCookies(signInPath(lang, { next, action: action ? rawAction : null }), []);
  }

  const db = getDb();
  await ensureProfile(db, signedIn.user.id, lang);
  const fresh = Date.now() - new Date(signedIn.session.createdAt).getTime() < FRESH_SESSION_MS;
  if (action && fresh) await runPendingAction(db, signedIn.user.id, action);

  return redirectWithCookies(next ?? myPath(lang), cookies.getSetCookie());
};
