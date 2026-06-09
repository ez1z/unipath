'use client';

import { useState, useTransition } from 'react';
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

  function handleSignOut() {
    setOpen(false);
    startTransition(async () => {
      await signOutAction(locale);
    });
  }

  const navLinks = [
    { href: `/${locale}/universities`, label: t('universities') },
    { href: `/${locale}/compare`, label: t('compare') },
    { href: `/${locale}/transfer`, label: t('transfer') },
    { href: `/${locale}/scholarships`, label: t('scholarships') },
    { href: `/${locale}/support`, label: t('support') },
  ];

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-white/50 hover:text-gold hover:bg-white/5 rounded-md transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed top-0 right-0 h-full w-72 max-w-[85vw] bg-brand-dark z-50 flex flex-col overflow-y-auto border-l border-white/10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <span className="font-heading font-bold text-lg text-gold tracking-wide">UniPath</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="p-2 text-white/40 hover:text-gold rounded-md transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Mobile navigation">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center px-4 py-3.5 rounded-lg text-white/65 hover:text-gold hover:bg-white/5 font-medium transition-colors min-h-[44px]"
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div className="border-t border-white/10 px-3 py-4 space-y-0.5">
              {user && (
                <Link
                  href={`/${locale}/tracker/profile`}
                  onClick={() => setOpen(false)}
                  className="flex items-center px-4 py-3.5 rounded-lg text-white/65 hover:text-gold hover:bg-white/5 font-medium transition-colors min-h-[44px]"
                >
                  {tAuth('tracker_nav')}
                </Link>
              )}
              {user ? (
                <button
                  onClick={handleSignOut}
                  disabled={isPending}
                  className="w-full flex items-center px-4 py-3.5 rounded-lg text-white/40 hover:text-gold hover:bg-white/5 font-medium transition-colors min-h-[44px] disabled:opacity-50"
                >
                  {isPending ? '…' : tAuth('signout_button')}
                </button>
              ) : (
                <>
                  <Link
                    href={`/${locale}/auth/signin`}
                    onClick={() => setOpen(false)}
                    className="flex items-center px-4 py-3.5 rounded-lg text-white/65 hover:text-gold hover:bg-white/5 font-medium transition-colors min-h-[44px]"
                  >
                    {tAuth('signin_button')}
                  </Link>
                  <Link
                    href={`/${locale}/auth/signup`}
                    onClick={() => setOpen(false)}
                    className="flex items-center px-4 py-3.5 rounded-lg font-semibold text-gold hover:bg-white/5 transition-colors min-h-[44px]"
                  >
                    {tAuth('signup_button')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
