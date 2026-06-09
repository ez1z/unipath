'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { resetAdminPasswordAction } from '@/app/admin/admins/actions';

export function ResetPasswordForm({ targetUserId }: { targetUserId: string }) {
  const t = useTranslations('admin');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await resetAdminPasswordAction(targetUserId, formData);
      if (result?.error) {
        setError(result.error);
      } else if (result?.success) {
        setSuccess(true);
        (e.target as HTMLFormElement).reset();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
          {t('reset_pw_label')}
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            disabled={isPending}
            aria-label="New password for this admin"
            className="w-full rounded-md border border-input bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 transition-shadow"
            placeholder={t('reset_pw_placeholder')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-crimson bg-crimson-light rounded-md px-3.5 py-2.5 border border-crimson/20">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-tk-green bg-tk-green/10 rounded-md px-3.5 py-2.5 border border-tk-green/20">
          {t('reset_pw_success')}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        aria-label="Set new password"
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60 transition-colors shadow-sm"
      >
        {isPending ? t('reset_pw_submitting') : t('reset_pw_submit')}
      </button>
    </form>
  );
}
