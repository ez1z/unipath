import type { APIRoute } from 'astro';
import { siteUrl } from '../lib/auth/server';
import { robotsTxt } from '../lib/sitemap';

// Rendered per request only to name the sitemap at the configured SITE_URL.
export const prerender = false;

export const GET: APIRoute = () =>
  new Response(robotsTxt(siteUrl()), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
