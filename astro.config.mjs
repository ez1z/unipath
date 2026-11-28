// @ts-check
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';
import { defineConfig } from 'astro/config';
import { META_DIRECTIVES, themeScriptHash } from './src/lib/security.ts';

// A new id per build, so cached HTML from an older deploy (with older CSS and asset
// names) is never served after a deploy. See cacheKey in src/lib/cache.ts.
const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  // Pages are static by default; data pages opt out with `export const prerender = false`.
  output: 'static',
  // Prerendered pages are written as about.html, so /en/about is served without a
  // redirect to /en/about/ and matches the links and canonical URLs.
  // CSS is inlined: on a 400 ms-round-trip phone network, a separate stylesheet costs
  // a whole extra round trip before anything shows (SPEC: first content in < 2 s).
  build: { format: 'file', inlineStylesheets: 'always' },
  trailingSlash: 'never',
  adapter: cloudflare({
    // Images are resized on upload (M7) and served from R2, so no runtime image service.
    imageService: 'passthrough',
    // Never reach real Cloudflare resources from local dev.
    remoteBindings: false,
  }),
  // Islands are written as React components; Preact's compat layer runs them in about
  // 5 KB instead of React's ~69 KB, which keeps pages under the 60 KB JavaScript budget.
  integrations: [preact({ compat: true })],
  // Better Auth owns sessions (M3); Astro's own KV-backed sessions stay off.
  session: false,
  security: {
    // CSRF: cross-site form posts to server pages are refused (Astro's default, kept explicit).
    checkOrigin: true,
    // A <meta> CSP on every page with hashes of Astro's scripts and styles; the
    // header half (frame-ancestors and friends) is in src/lib/security.ts.
    csp: {
      directives: [...META_DIRECTIVES],
      scriptDirective: { hashes: [await themeScriptHash()] },
    },
  },
  devToolbar: { enabled: false },
  // No Markdown code blocks; Shiki's inline styles wouldn't pass the CSP anyway.
  markdown: { syntaxHighlight: false },
  vite: { define: { __BUILD_ID__: JSON.stringify(BUILD_ID) } },
});
