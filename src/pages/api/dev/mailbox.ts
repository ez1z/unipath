import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { devMailboxEnabled } from '../../../lib/auth/server';
import { DEV_MAILBOX_PREFIX, type DevMailboxEntry } from '../../../lib/email';

export const prerender = false;

/**
 * Local only: the last email "sent" to an address (sign-in codes print to the
 * console in dev; tests read them here). 404 unless DEV_MAILBOX=1 on a
 * localhost SITE_URL with no real email binding, so it can't exist in production.
 */
export const GET: APIRoute = async ({ url }) => {
  if (!devMailboxEnabled()) return new Response(null, { status: 404 });
  const to = (url.searchParams.get('to') ?? '').trim().toLowerCase();
  const raw = to ? await env.KV.get(DEV_MAILBOX_PREFIX + to) : null;
  if (!raw) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const entry = JSON.parse(raw) as DevMailboxEntry;
  return Response.json(entry, { headers: { 'Cache-Control': 'no-store' } });
};
