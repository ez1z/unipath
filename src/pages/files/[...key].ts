import type { APIRoute } from 'astro';
import { PUBLIC_IMAGE_KEY } from '../../lib/admin/images';
import { filesBucket } from '../../lib/server';

export const prerender = false;

/**
 * Logos and photos from R2. Only `logos/` and `photos/` keys are served
 * (never `backups/`). Every upload gets a new key, so files cache for a year.
 */
export const GET: APIRoute = async ({ params, request }) => {
  const key = params['key'] ?? '';
  const files = filesBucket();
  if (!files || !PUBLIC_IMAGE_KEY.test(key)) return new Response('Not found', { status: 404 });
  const object = await files.get(key, { onlyIf: request.headers });
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers({
    'Content-Type': 'image/webp',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    ETag: object.httpEtag,
  });
  // `onlyIf` matched an If-None-Match: the browser already has it.
  if (!('body' in object) || !object.body) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
};
