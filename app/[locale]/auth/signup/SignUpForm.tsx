'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { signUpWithEmailAction } from '../actions';
import type { Locale } from '@/lib/constants';

type Props = { locale: Locale };

export function SignUpForm({ locale }: Props) {
  const t = useTranslations('auth');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await signUpWithEmailAction(locale, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-xl font-bold text-foreground">{t('signup_title')}</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
            {t('name_label')}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder={t('name_placeholder')}
            required
            disabled={isPending}
            className="w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 transition-shadow"
          />
        </div>

        <div>
          <label htmlFor="age" className="block text-sm font-medium text-foreground mb-1.5">
            {t('age_label')}
          </label>
          <input
            id="age"
            name="age"
            type="number"
            min="14"
            max="100"
            placeholder={t('age_placeholder')}
            required
            disabled={isPending}
            className="w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 transition-shadow"
          />
        </div>

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
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              disabled={isPending}
              className="w-full rounded-md border border-input bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 transition-shadow"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? t('hide_password') : t('show_password')}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
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
          {isPending ? t('signing_up') : t('signup_button')}
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {t('have_account')}{' '}
        <Link href={`/${locale}/auth/signin`} className="text-primary font-medium hover:underline">
          {t('signin_link')}
        </Link>
      </p>
    </div>
  );
}
