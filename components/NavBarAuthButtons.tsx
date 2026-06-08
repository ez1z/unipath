'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { signOutAction } from '@/app/[locale]/auth/actions';
import type { Locale } from '@/lib/constants';
import type { User } from '@supabase/supabase-js';

type Props = { locale: Locale; user: User | null };

export function NavBarAuthButtons({ locale, user }: Props) {
  const t = useTranslations('auth');
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!user) {
    return (
      <div className="hidden sm:flex items-center gap-2 ml-1">
        <Link
          href={`/${locale}/auth/signin`}
          className="px-3 py-1.5 text-xs font-semibold text-primary-foreground/80 hover:text-gold transition-colors"
        >
          {t('signin_button')}
        </Link>
        <Link
          href={`/${locale}/auth/signup`}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-gold text-white hover:opacity-90 transition-opacity"
        >
          {t('signup_button')}
        </Link>
      </div>
    );
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split('@')[0] ??
    '?';
  const initial = displayName[0].toUpperCase();

  function handleSignOut() {
    setOpen(false);
    startTransition(async () => {
      await signOutAction(locale);
    });
  }

  return (
    <div ref={ref} className="relative hidden sm:block ml-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('profile_link')}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
      >
        <span className="w-6 h-6 rounded-full bg-gold flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {initial}
        </span>
        <span className="text-xs font-medium text-primary-foreground/80 max-w-[96px] truncate">
          {displayName}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-primary-foreground/50 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-card border border-border rounded-xl shadow-card-hover z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <Link
            href={`/${locale}/tracker/profile`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {t('tracker_nav')}
          </Link>
          <button
            onClick={handleSignOut}
            disabled={isPending}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 border-t border-border"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {isPending ? '…' : t('signout_button')}
          </button>
        </div>
      )}
    </div>
  );
}
