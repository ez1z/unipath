import { defineMiddleware } from 'astro:middleware';
import { cachePolicy, withPageCache, type CacheContext } from './lib/cache';
import { applySecurityHeaders } from './lib/security';
import { hintCookie } from './lib/signed-in-hint';

/**
 * Public server pages go through the page cache (lib/cache.ts). In `astro dev`
 * the cache is off, so edits show at once. Every Worker response gets the
 * security headers (lib/security.ts); prerendered pages get them from
 * public/_headers.
 *
 * Uncached responses also keep the signed-in hint cookie in line with the
 * session (lib/signed-in-hint.ts), so cached pages can say "My Clav".
 */
export const onRequest = defineMiddleware(async (context, next) => {
  if (context.isPrerendered) return next();

  const policy = cachePolicy(context.url);
  if (policy) context.locals.canonicalQuery = policy.query;

  let cacheContext: CacheContext | null = null;
  if (!import.meta.env.DEV && policy && typeof caches !== 'undefined') {
    // Imported here, not at the top: prerendering runs this module outside workerd.
    const { env } = await import('cloudflare:workers');
    const cf = context.locals.cfContext;
    cacheContext = {
      // The DOM lib's CacheStorage (for islands) hides the Workers-only `default` cache.
      cache: (caches as unknown as { default: Cache }).default,
      kv: env.KV,
      waitUntil: (promise) => cf.waitUntil(promise),
    };
  }
  let response = await withPageCache(context.request, () => next(), cacheContext);
  try {
    response.headers.set('X-Clavis-Probe', '1');
    response.headers.delete('X-Clavis-Probe');
  } catch {
    // Immutable headers (a response from the cache or a fetch): copy it.
    response = new Response(response.body, response);
  }
  // Everything rendered per request that isn't a cached public page (account,
  // sign-in, share, admin, API) is private unless it says otherwise.
  if (!policy && !response.headers.has('Cache-Control')) {
    response.headers.set('Cache-Control', 'private, no-store');
  }
  if (!policy) {
    const hint = hintCookie(
      context.request.headers.get('Cookie') ?? '',
      response.headers.getSetCookie(),
      context.url.protocol === 'https:',
    );
    if (hint) response.headers.append('Set-Cookie', hint);
  }
  applySecurityHeaders(response.headers, context.url);
  return response;
});
