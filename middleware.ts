import { NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from '@/lib/i18n/routing';

const handleIntl = createIntlMiddleware(routing);

function hasAuthSession(request: NextRequest): boolean {
  return request.cookies.getAll().some(({ name }) => name.startsWith('sb-'));
}

function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase, response };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── API routes ────────────────────────────────────────────────────────────
  // Skip i18n rewriting and auth handling so route handlers (e.g. /api/chat)
  // are reached untouched.
  if (pathname.startsWith('/api')) return NextResponse.next();

  // ── Admin routes ──────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/signin') return NextResponse.next();

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.redirect(new URL('/admin/signin', request.url));
    }

    let response = NextResponse.next({ request });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    let user = null;
    try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    } catch {
      // Supabase unreachable — treat as unauthenticated
    }

    if (!user) return NextResponse.redirect(new URL('/admin/signin', request.url));
    return response;
  }

  // ── Public locale routes ──────────────────────────────────────────────────
  // Skip Supabase entirely for anonymous visitors (no sb-* cookies present)
  if (
    !hasAuthSession(request) ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return handleIntl(request);
  }

  // Logged-in user: refresh token + tracker guard
  const { supabase, response } = createSupabaseMiddlewareClient(request);

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase unreachable — let them through
  }

  // Protect /[locale]/tracker/*
  const trackerMatch = pathname.match(/^\/(tk|ru|en)\/tracker(\/.*)?$/);
  if (trackerMatch && !user) {
    const locale = trackerMatch[1];
    const redirectUrl = new URL(`/${locale}/auth/signin`, request.url);
    redirectUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Merge Supabase refresh cookies into the intl response
  const intlResponse = handleIntl(request);
  response.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  return intlResponse;
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
