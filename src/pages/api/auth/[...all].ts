import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { emailEnabled, getAuth } from '../../../lib/auth/server';
import { clientIp } from '../../../lib/server';

export const prerender = false;

/** Requests that send a code or try one: limited per IP on top of Better Auth's own checks. */
const LIMITED = [
  '/api/auth/email-otp/send-verification-otp',
  '/api/auth/email-otp/request-email-change',
  '/api/auth/sign-in/email-otp',
  '/api/auth/email-otp/change-email',
  '/api/auth/telegram/callback',
];

/** Better Auth's handler for everything under /api/auth. Never cached. */
export const ALL: APIRoute = async ({ request, url }) => {
  // Email codes are off without a sender (auth/server.ts emailEnabled): no such routes.
  if (!emailEnabled() && /^\/api\/auth\/(email-otp\/|sign-in\/email-otp$)/.test(url.pathname)) {
    return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  }
  if (LIMITED.includes(url.pathname)) {
    const { success } = await env.AUTH_LIMITER.limit({ key: `auth:${clientIp(request)}` });
    if (!success) {
      return Response.json(
        { code: 'RATE_LIMITED', message: 'Too many attempts. Wait a minute and try again.' },
        { status: 429, headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '60' } },
      );
    }
  }
  const response = await getAuth().handler(request);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(response.body, { status: response.status, headers });
};
