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
    <tr className="border-t border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 font-medium text-foreground">
        {user.email}
        {isSelf && <span className="ml-2 text-xs text-muted-foreground">{"(you)"}</span>}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleBadgeClass}`}>
          {user.role === 'none' ? "None" : user.role}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground text-sm">
        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB') : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        {!isSelf && (
          <div className="flex items-center justify-end gap-3">
            <select
              value={user.role}
              onChange={handleRoleChange}
              disabled={isPending}
              aria-label={`Change role for ${user.email}`}
              className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground disabled:opacity-50 cursor-pointer"
            >
              <option value="none">{"None"}</option>
              <option value="admin">{"Admin"}</option>
              <option value="superuser">{"Superuser"}</option>
            </select>
            {user.role !== 'none' && user.role !== 'superuser' && (
              <Link
                href={`/admin/admins/${user.userId}`}
                aria-label={`Reset password for ${user.email}`}
                className="text-xs text-primary hover:underline"
              >
                {"Reset Password"}
              </Link>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
