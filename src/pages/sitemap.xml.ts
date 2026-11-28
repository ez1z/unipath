import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { siteUrl } from '../lib/auth/server';
import { loadSitemapEntries, sitemapXml } from '../lib/sitemap';

// From D1, so a newly published record is listed at once; cached like the
// data pages (lib/cache.ts SITEMAP_PATH) until the next admin edit.
export const prerender = false;

export const GET: APIRoute = async () => {
  const entries = await loadSitemapEntries(env.DB);
  return new Response(sitemapXml(siteUrl(), entries), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
