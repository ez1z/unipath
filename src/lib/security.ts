/**
 * Security headers and the Content-Security-Policy (SPEC: "strict
 * Content-Security-Policy; no inline scripts except Astro's own").
 *
 * The policy comes in two parts:
 *
 * - A `<meta http-equiv="content-security-policy">` that Astro writes into
 *   every page (astro.config.mjs `security.csp`), with hashes of the scripts
 *   and styles it renders, the inline theme script's hash, and META_DIRECTIVES.
 * - Response headers (SECURITY_HEADERS): the directives a `<meta>` policy
 *   can't carry (frame-ancestors) and the other security headers. The
 *   middleware adds them to pages rendered by the Worker; public/_headers
 *   adds the same to prerendered pages and files (a unit test keeps the two
 *   the same).
 *
 * Third-party code: only the Telegram Login Widget, on /<lang>/sign-in/telegram
 * (it adds https://telegram.org there), which opens oauth.telegram.org in a frame.
 */
import { THEME_SCRIPT } from './theme.ts';

/** Directives for Astro's `<meta>` policy (script-src and style-src are Astro's). */
export const META_DIRECTIVES = [
  "default-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'none'",
  "worker-src 'none'",
  "manifest-src 'self'",
  'frame-src https://oauth.telegram.org',
] as const;

/**
 * Header-only directives. The Mini App runs in a frame on Telegram Web, so
 * web.telegram.org (and only it) may frame Clavis.
 */
export const HEADER_CSP = [
  'frame-ancestors https://web.telegram.org',
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ');

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': HEADER_CSP,
  'X-Content-Type-Options': 'nosniff',
  // Same-origin referrers stay: the Mini App back button relies on them (M6 notes).
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  // The Telegram Login Widget talks to its own popup.
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
};

/** HTTPS only: browsers then refuse plain http for a year. */
export const HSTS = 'max-age=31536000; includeSubDomains';

/**
 * Adds the security headers a response doesn't already set. Pages rendered
 * per request carry Astro's policy as a header (prerendered ones as a
 * `<meta>`), so the header-only directives are appended to it.
 */
export function applySecurityHeaders(headers: Headers, url: URL): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (name === 'Content-Security-Policy') {
      const astro = headers.get(name)?.trim().replace(/;+$/, '');
      if (!astro) headers.set(name, value);
      else if (!astro.includes('frame-ancestors')) headers.set(name, `${astro}; ${value}`);
    } else if (!headers.has(name)) headers.set(name, value);
  }
  if (url.protocol === 'https:' && !headers.has('Strict-Transport-Security')) {
    headers.set('Strict-Transport-Security', HSTS);
  }
}

/** `sha256-…` of an inline script, as CSP expects it. */
export async function cspHash(source: string): Promise<`sha256-${string}`> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `sha256-${btoa(binary)}`;
}

export const themeScriptHash = () => cspHash(THEME_SCRIPT);

/** public/_headers: the same headers for prerendered pages and files. */
export function headersFile(): string {
  const lines = ['# Generated from src/lib/security.ts (a unit test keeps it in step).', '/*'];
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) lines.push(`  ${name}: ${value}`);
  lines.push(`  Strict-Transport-Security: ${HSTS}`);
  return `${lines.join('\n')}\n`;
}
