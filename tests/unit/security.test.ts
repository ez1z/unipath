import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  applySecurityHeaders,
  cspHash,
  HEADER_CSP,
  headersFile,
  HSTS,
  META_DIRECTIVES,
  themeScriptHash,
} from '../../src/lib/security';

describe('security headers', () => {
  it('public/_headers is the generated file', () => {
    // Regenerate with `pnpm security:headers`.
    expect(readFileSync('public/_headers', 'utf8').replace(/\r\n/g, '\n')).toBe(headersFile());
  });

  it('only Telegram Web may frame the site', () => {
    expect(HEADER_CSP).toContain('frame-ancestors https://web.telegram.org');
    expect(HEADER_CSP).not.toMatch(/frame-ancestors[^;]*\*/);
  });

  it('the meta policy allows no inline or remote code', () => {
    const all = META_DIRECTIVES.join('; ');
    expect(all).not.toContain('unsafe-inline');
    expect(all).not.toContain('unsafe-eval');
    expect(all).toContain("default-src 'self'");
  });

  it('adds every header to a bare response, HSTS only on https', () => {
    const plain = new Headers();
    applySecurityHeaders(plain, new URL('http://localhost:4321/en'));
    expect(plain.get('Content-Security-Policy')).toBe(HEADER_CSP);
    expect(plain.get('X-Content-Type-Options')).toBe('nosniff');
    expect(plain.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(plain.has('Strict-Transport-Security')).toBe(false);

    const secure = new Headers();
    applySecurityHeaders(secure, new URL('https://clavis.example/en'));
    expect(secure.get('Strict-Transport-Security')).toBe(HSTS);
  });

  it("appends the header-only directives to Astro's own policy, once", () => {
    const headers = new Headers({
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'sha256-abc';",
    });
    const url = new URL('https://clavis.example/en/search');
    applySecurityHeaders(headers, url);
    applySecurityHeaders(headers, url);
    expect(headers.get('Content-Security-Policy')).toBe(
      `default-src 'self'; script-src 'self' 'sha256-abc'; ${HEADER_CSP}`,
    );
  });

  it('keeps headers a route set itself', () => {
    const headers = new Headers({ 'Referrer-Policy': 'no-referrer' });
    applySecurityHeaders(headers, new URL('http://localhost/'));
    expect(headers.get('Referrer-Policy')).toBe('no-referrer');
  });
});

describe('cspHash', () => {
  it('is the base64 SHA-256 CSP expects', async () => {
    // printf '' | openssl dgst -sha256 -binary | base64
    expect(await cspHash('')).toBe('sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=');
  });

  it('covers the inline theme script', async () => {
    expect(await themeScriptHash()).toMatch(/^sha256-[A-Za-z0-9+/]{43}=$/);
  });
});
