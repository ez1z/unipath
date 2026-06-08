'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { signOutAction } from '@/app/[locale]/auth/actions';
import type { Locale } from '@/lib/constants';
import type { User } from '@supabase/supabase-js';


type Props = { locale: Locale; user: User | null };

export function NavBarAuthButtons({ locale, user }: Props) {
  const t = useTranslations('auth');
  const [isPending, startTransition] = useTransition();

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
    startTransition(async () => {
      await signOutAction(locale);
    });
  }

  return (
    <div className="hidden sm:flex items-center gap-2 ml-1">
      <Link
        href={`/${locale}/tracker/profile`}
        className="w-7 h-7 rounded-full bg-gold flex items-center justify-center text-white text-xs font-bold flex-shrink-0 hover:opacity-80 transition-opacity"
        title={displayName}
        aria-label={t('profile_link')}
      >
        {initial}
      </Link>
      <button
        onClick={handleSignOut}
        disabled={isPending}
        aria-label={t('signout_button')}
        className="px-2 py-1 text-xs font-medium text-primary-foreground/60 hover:text-gold transition-colors disabled:opacity-50"
      >
        {isPending ? '…' : t('signout_button')}
      </button>
    </div>
  );
}
