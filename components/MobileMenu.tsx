'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/lib/constants';
import type { User } from '@supabase/supabase-js';
import { signOutAction } from '@/app/[locale]/auth/actions';

type Props = { locale: Locale; user: User | null };

export function MobileMenu({ locale, user }: Props) {
  const t = useTranslations('nav');
  const tAuth = useTranslations('auth');
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleSignOut() {
    setOpen(false);
    startTransition(async () => {
      await signOutAction(locale);
    });
  }

  return (
    <div ref={ref} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle navigation menu"
        aria-expanded={open}
        className="p-2 text-primary-foreground/80 hover:text-gold transition-colors"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-primary border border-white/10 rounded-xl shadow-card-hover z-50 overflow-hidden">
          <Link
            href={`/${locale}/universities`}
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm text-primary-foreground/80 hover:text-gold hover:bg-white/5 transition-colors"
          >
            {t('universities')}
          </Link>
          <Link
            href={`/${locale}/compare`}
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm text-primary-foreground/80 hover:text-gold hover:bg-white/5 transition-colors border-t border-white/5"
          >
            {t('compare')}
          </Link>
          <Link
            href={`/${locale}/transfer`}
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm text-primary-foreground/80 hover:text-gold hover:bg-white/5 transition-colors border-t border-white/5"
          >
            {t('transfer')}
          </Link>
          <Link
            href={`/${locale}/scholarships`}
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm text-primary-foreground/80 hover:text-gold hover:bg-white/5 transition-colors border-t border-white/5"
          >
            {t('scholarships')}
          </Link>
          <Link
            href={`/${locale}/support`}
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm text-primary-foreground/80 hover:text-gold hover:bg-white/5 transition-colors border-t border-white/5"
          >
            {t('support')}
          </Link>

          <div className="border-t border-white/10 mt-1 pt-1">
            {user && (
              <Link
                href={`/${locale}/tracker/profile`}
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-sm text-primary-foreground/80 hover:text-gold hover:bg-white/5 transition-colors"
              >
                {tAuth('tracker_nav')}
              </Link>
            )}
            {user ? (
              <button
                onClick={handleSignOut}
                disabled={isPending}
                className="w-full text-left px-4 py-3 text-sm text-primary-foreground/60 hover:text-gold hover:bg-white/5 transition-colors disabled:opacity-50 border-t border-white/5"
              >
                {isPending ? '…' : tAuth('signout_button')}
              </button>
            ) : (
              <>
                <Link
                  href={`/${locale}/auth/signin`}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 text-sm text-primary-foreground/80 hover:text-gold hover:bg-white/5 transition-colors"
                >
                  {tAuth('signin_button')}
                </Link>
                <Link
                  href={`/${locale}/auth/signup`}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 text-sm font-semibold text-gold hover:bg-white/5 transition-colors border-t border-white/5"
                >
                  {tAuth('signup_button')}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
