'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { removeAdminAction } from '@/app/admin/admins/actions';

type AdminRow = {
  userId: string;
  role: 'admin' | 'superuser';
  email: string;
  createdAt?: string;
};

export function AdminAdminRow({ admin, isSelf }: { admin: AdminRow; isSelf: boolean }) {
  const t = useTranslations('admin');
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    if (!confirm(t('admins_remove_confirm', { email: admin.email }))) return;
    startTransition(async () => {
      const result = await removeAdminAction(admin.userId);
      if (result?.error) alert(`Error: ${result.error}`);
    });
  }

  return (
    <tr className="border-t border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 font-medium text-foreground">
        {admin.email}
        {isSelf && <span className="ml-2 text-xs text-muted-foreground">{t('admins_you')}</span>}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
          admin.role === 'superuser'
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-primary/10 text-primary border border-primary/20'
        }`}>
          {admin.role}
        </span>
      </td>
      <td className="px-4 py-3 text-muted-foreground text-sm">
        {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString('en-GB') : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        {admin.role !== 'superuser' && (
          <div className="flex items-center justify-end gap-3">
            <Link
              href={`/admin/admins/${admin.userId}`}
              aria-label={`Reset password for ${admin.email}`}
              className="text-xs text-primary hover:underline"
            >
              {t('admins_reset_password')}
            </Link>
            <button
              onClick={handleRemove}
              disabled={isPending}
              aria-label={`Remove admin ${admin.email}`}
              className="text-xs text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50"
            >
              {t('admins_remove')}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
