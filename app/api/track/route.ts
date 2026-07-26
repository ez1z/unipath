import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { SUPPORTED_LOCALES } from '@/lib/constants';
import { createServiceClient } from '@/lib/supabase/service';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const VISITOR_COOKIE = 'up_vid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const BodySchema = z.object({
  event_type: z.enum(['pageview', 'university_view', 'scholarship_view', 'search', 'ai_question']),
  path: z.string().max(512).optional(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  referrer: z.string().max(512).optional(),
  entity_id: z.string().uuid().optional(),
  entity_slug: z.string().max(256).optional(),
  country: z.string().max(128).optional(),
  city: z.string().max(128).optional(),
  search_query: z.string().max(256).optional(),
});

// Coarse device class from user-agent. Server-side so it can't be spoofed by the
// beacon payload. Order matters: tablets often also match the mobile keywords.
function parseDevice(ua: string | null): string {
  if (!ua) return 'unknown';
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk|kindle|(android(?!.*mobi))/.test(s)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini|windows phone/.test(s)) return 'mobile';
  return 'desktop';
}

// ── Lightweight in-memory rate limit (per IP) ───────────────────────────────
// Blunts beacon spam. Resets on cold start — acceptable for first-party analytics.
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

function getIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd ? fwd.split(',')[0].trim() : 'unknown';
}

export async function POST(req: NextRequest) {
  if (isRateLimited(getIp(req))) {
    return new NextResponse(null, { status: 429 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  // Stable anonymous visitor id, set httpOnly so it is authoritative for both
  // beacon events here and server-side events (the chat route reads it too).
  const cookieStore = await cookies();
  let visitorId = cookieStore.get(VISITOR_COOKIE)?.value;
  if (!visitorId) {
    visitorId = randomUUID();
    cookieStore.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });
  }

  // Best-effort user attribution — only pay the auth lookup when a Supabase
  // session cookie is present (anonymous traffic skips it, like the middleware).
  let userId: string | null = null;
  const hasAuthCookie = cookieStore.getAll().some((c) => c.name.startsWith('sb-'));
  if (hasAuthCookie) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
    } catch {
      // ignore — attribution is optional
    }
  }

  try {
    const service = createServiceClient();
    await service.from('analytics_events').insert({
      event_type: body.event_type,
      visitor_id: visitorId,
      user_id: userId,
      path: body.path ?? null,
      locale: body.locale ?? null,
      referrer: body.referrer ?? null,
      entity_id: body.entity_id ?? null,
      entity_slug: body.entity_slug ?? null,
      country: body.country ?? null,
      city: body.city ?? null,
      device: parseDevice(req.headers.get('user-agent')),
      search_query: body.search_query ?? null,
    });
  } catch {
    // Never surface tracking failures to the user.
  }

  return new NextResponse(null, { status: 204 });
}
