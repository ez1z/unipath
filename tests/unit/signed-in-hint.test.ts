import { describe, expect, it } from 'vitest';
import { hintCookie, signedInAfter } from '../../src/lib/signed-in-hint';

const SESSION = 'clavis.session_token=abc.def';

describe('signed-in hint cookie', () => {
  it('follows the session cookie on the request', () => {
    expect(signedInAfter(`theme=dark; ${SESSION}`, [])).toBe(true);
    expect(signedInAfter(`__Secure-${SESSION}`, [])).toBe(true);
    expect(signedInAfter('theme=dark', [])).toBe(false);
    expect(signedInAfter('clavis.session_token=', [])).toBe(false);
  });

  it('lets a Set-Cookie for the session win: sign-in and sign-out', () => {
    expect(signedInAfter('', [`${SESSION}; Path=/; HttpOnly`])).toBe(true);
    expect(signedInAfter(SESSION, ['clavis.session_token=; Path=/; Max-Age=0'])).toBe(false);
    expect(signedInAfter(SESSION, ['__Secure-clavis.session_token=x; Max-Age=0'])).toBe(false);
  });

  it('sets the hint once, and clears it when the session is gone', () => {
    expect(hintCookie(SESSION, [], false)).toMatch(/^clavis_in=1; Max-Age=2592000; Path=\//);
    expect(hintCookie(`${SESSION}; clavis_in=1`, [], false)).toBeNull();
    expect(hintCookie('clavis_in=1', [], true)).toBe(
      'clavis_in=; Max-Age=0; Path=/; SameSite=Lax; Secure',
    );
    expect(hintCookie('theme=dark', [], false)).toBeNull();
  });

  it('is readable by page scripts (no HttpOnly) and carries no session data', () => {
    const cookie = hintCookie(SESSION, [], true) ?? '';
    expect(cookie).not.toMatch(/HttpOnly/i);
    expect(cookie).not.toContain('abc');
  });
});
