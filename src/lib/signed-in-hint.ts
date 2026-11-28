/**
 * Cached public pages are the same for everyone, so their header always says
 * "Sign in". A readable hint cookie (no secret: it only says "a session cookie
 * is here") lets a few lines of script in AppShell show "My Clav" instead.
 * The middleware sets and clears it only on uncached responses, so it never
 * enters the page cache. It changes a label, never access: every account page
 * still checks the real session.
 */
export const SIGNED_IN_HINT = 'clavis_in';

const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?clavis\.session_token=[^;]/;
const SESSION_SET = /^(?:__Secure-)?clavis\.session_token=/;
const HINT = new RegExp(`(?:^|;\\s*)${SIGNED_IN_HINT}=1(?:;|$)`);
const MAX_AGE = 60 * 60 * 24 * 30; // like the session: 30 days

/** Signed in once this response arrives? A session Set-Cookie decides, else the request's cookies. */
export function signedInAfter(requestCookies: string, setCookies: string[]): boolean {
  // A new token signs in; an empty or expired one (sign-out, deleted account) signs out.
  const session = setCookies.find((c) => SESSION_SET.test(c));
  if (session) return !/^[^=]+=;|max-age=0/i.test(session);
  return SESSION_COOKIE.test(requestCookies);
}

/** The Set-Cookie that brings the hint in line with the session, or null if it already is. */
export function hintCookie(
  requestCookies: string,
  setCookies: string[],
  secure: boolean,
): string | null {
  const signedIn = signedInAfter(requestCookies, setCookies);
  const hasHint = HINT.test(requestCookies);
  const flags = `Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
  if (signedIn && !hasHint) return `${SIGNED_IN_HINT}=1; Max-Age=${MAX_AGE}; ${flags}`;
  if (!signedIn && hasHint) return `${SIGNED_IN_HINT}=; Max-Age=0; ${flags}`;
  return null;
}
