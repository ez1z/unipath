import { defineMiddleware } from 'astro:middleware';
import { cachePolicy, withPageCache, type CacheContext } from './lib/cache';

/**
 * Public server pages go through the page cache (lib/cache.ts). In `astro dev`
 * the cache is off, so edits show at once.
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
  return withPageCache(context.request, () => next(), cacheContext);
});
