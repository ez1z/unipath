'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { signInWithEmailAction } from '../actions';
import type { Locale } from '@/lib/constants';

type Props = { locale: Locale };

export function SignInForm({ locale }: Props) {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const oauthError = searchParams.get('error') === 'oauth_failed';
  const [error, setError] = useState<string | null>(oauthError ? t('error_oauth') : null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await signInWithEmailAction(locale, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-xl font-bold text-foreground">{t('signin_title')}</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
            {t('email_label')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={isPending}
            className="w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 transition-shadow"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
            {t('password_label')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={isPending}
            className="w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 transition-shadow"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-md px-3.5 py-2.5 border border-red-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60 transition-opacity shadow-sm"
        >
          {isPending ? t('signing_in') : t('signin_button')}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t('no_account')}{' '}
        <Link href={`/${locale}/auth/signup`} className="text-primary font-medium hover:underline">
          {t('signup_link')}
        </Link>
      </p>
    </div>
  );
}
