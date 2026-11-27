import type { APIRoute } from 'astro';
import { isAPIError } from 'better-auth/api';
import { isLang } from '../../../i18n/config';
import { parsePendingAction } from '../../../lib/account';
import { safeNextPath } from '../../../lib/auth/next';
import { getAuth, getSignedIn, googleEnabled, redirectWithCookies } from '../../../lib/auth/server';
import { continuePath, myPath, signInPath } from '../../../lib/auth/urls';

export const prerender = false;

/**
 * "Continue with Google" (a form POST, so it works without JavaScript). Signed
 * out: sign in. Signed in (Profile): link Google to this account. Either way
 * the browser goes to Google with a state cookie set here.
 */
export const POST: APIRoute = async ({ params, request }) => {
  const lang = params['lang'];
  if (!isLang(lang)) return new Response(null, { status: 404 });

  const form = await request.formData();
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value : null;
  };
  const next = safeNextPath(field('next'));
  const action = parsePendingAction(field('action')) ? field('action') : null;
  const to = { next, action };
  const failed = signInPath(lang, to, { error: 'google' });
  if (!googleEnabled()) return redirectWithCookies(failed, []);

  const auth = getAuth();
  try {
    if (await getSignedIn(request.headers)) {
      const profile = myPath(lang, 'profile');
      const { headers, response } = await auth.api.linkSocialAccount({
        body: { provider: 'google', callbackURL: profile, errorCallbackURL: profile },
        headers: request.headers,
        returnHeaders: true,
      });
      return redirectWithCookies(response.url, headers.getSetCookie());
    }
    const { headers, response } = await auth.api.signInSocial({
      body: {
        provider: 'google',
        callbackURL: continuePath(lang, to),
        newUserCallbackURL: continuePath(lang, to),
        errorCallbackURL: failed,
        disableRedirect: true,
      },
      headers: request.headers,
      returnHeaders: true,
    });
    if (!response.url) return redirectWithCookies(failed, []);
    return redirectWithCookies(response.url, headers.getSetCookie());
  } catch (error) {
    if (!isAPIError(error)) throw error;
    return redirectWithCookies(failed, []);
  }
};
