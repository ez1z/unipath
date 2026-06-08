'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { signInWithEmailAction, signInWithOAuthAction } from '../actions';
import type { Locale } from '@/lib/constants';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

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

  function handleGoogle() {
    setError(null);
    startTransition(async () => {
      const result = await signInWithOAuthAction(locale);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-xl font-bold text-foreground">{t('signin_title')}</h1>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={isPending}
        aria-label={t('continue_with_google')}
        className="w-full flex items-center justify-center gap-2.5 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
      >
        <GoogleIcon />
        {t('continue_with_google')}
      </button>

      <div className="relative" aria-hidden="true">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-2 text-muted-foreground">{t('or')}</span>
        </div>
      </div>

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
        <Link
          href={`/${locale}/auth/signup`}
          className="text-primary font-medium hover:underline"
        >
          {t('signup_link')}
        </Link>
      </p>
    </div>
  );
}
