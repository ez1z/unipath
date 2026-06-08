'use client';

import { useState, useTransition } from 'react';
import { resetAdminPasswordAction } from '@/app/admin/admins/actions';

export function ResetPasswordForm({ targetUserId }: { targetUserId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

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
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          disabled={isPending}
          aria-label="New password for this admin"
          className="w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 transition-shadow"
          placeholder="Min. 8 characters"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-crimson bg-crimson-light rounded-md px-3.5 py-2.5 border border-crimson/20">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-tk-green bg-tk-green/10 rounded-md px-3.5 py-2.5 border border-tk-green/20">
          Password updated successfully.
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        aria-label="Set new password"
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60 transition-colors shadow-sm"
      >
        {isPending ? 'Saving…' : 'Set New Password'}
      </button>
    </form>
  );
}
