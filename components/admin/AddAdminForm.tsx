'use client';

import { useState, useTransition } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { addAdminAction } from '@/app/admin/admins/actions';

export function AddAdminForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addAdminAction(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
          {"Email address"}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="off"
          disabled={isPending}
          aria-label="Admin email address"
          className="w-full rounded-md border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 transition-shadow"
          placeholder={"admin@example.com"}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
          {"Password"}
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            disabled={isPending}
            aria-label="Admin password"
            className="w-full rounded-md border border-input bg-background px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 transition-shadow"
            placeholder={"Min. 8 characters"}
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
      <button
        type="submit"
        disabled={isPending}
        aria-label="Create admin account"
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-60 transition-colors shadow-sm"
      >
        {isPending ? "Creating…" : "Create Admin"}
      </button>
    </form>
  );
}
