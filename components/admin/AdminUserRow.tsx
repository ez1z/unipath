'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { setUserRoleAction } from '@/app/admin/admins/actions';

type UserRow = {
  userId: string;
  role: 'admin' | 'superuser' | 'none';
  email: string;
  createdAt?: string;
};

export function AdminUserRow({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value as 'admin' | 'superuser' | 'none';
    if (!confirm(`Change role for "${user.email}" to ${newRole === 'none' ? 'None' : newRole}?`)) return;
    startTransition(async () => {
      const result = await setUserRoleAction(user.userId, newRole);
      if (result?.error) alert(`Failed to update role: ${result.error}`);
    });
  }

  const roleBadgeClass =
    user.role === 'superuser'
      ? 'bg-amber-50 text-amber-700 border border-amber-200'
      : user.role === 'admin'
      ? 'bg-primary/10 text-primary border border-primary/20'
      : 'bg-muted text-muted-foreground border border-border';

  return (
    <div className="border-t border-border first:border-t-0 hover:bg-muted/30 transition-colors px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground break-all">{user.email}</span>
          {isSelf && <span className="text-xs text-muted-foreground">{"(you)"}</span>}
          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleBadgeClass}`}>
            {user.role === 'none' ? "None" : user.role}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {user.createdAt
            ? `Joined ${new Date(user.createdAt).toLocaleDateString('en-GB')}`
            : '—'}
        </p>
      </div>

      {!isSelf && (
        <div className="flex items-center gap-3 shrink-0">
          <select
            value={user.role}
            onChange={handleRoleChange}
            disabled={isPending}
            aria-label={`Change role for ${user.email}`}
            className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground disabled:opacity-50 cursor-pointer flex-1 sm:flex-none"
          >
            <option value="none">{"None"}</option>
            <option value="admin">{"Admin"}</option>
            <option value="superuser">{"Superuser"}</option>
          </select>
          {user.role !== 'none' && user.role !== 'superuser' && (
            <Link
              href={`/admin/admins/${user.userId}`}
              aria-label={`Reset password for ${user.email}`}
              className="text-sm text-primary hover:underline whitespace-nowrap"
            >
              {"Reset Password"}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
