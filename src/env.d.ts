/// <reference types="@astrojs/cloudflare/types.d.ts" />

/** Set per build in astro.config.mjs; undefined in tests and scripts. */
declare const __BUILD_ID__: string | undefined;

declare namespace App {
  interface Locals {
    /**
     * The query string the page reads, in canonical order (see lib/cache.ts). Canonical
     * and hreflang links use it, so a cached page never repeats a stray query.
     */
    canonicalQuery?: string;
  }
}
