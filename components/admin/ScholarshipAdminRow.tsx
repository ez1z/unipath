'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { deleteScholarshipAction } from '@/app/admin/scholarships/actions';

type RowData = {
  id: string;
  name_en: string;
  country: string;
  type: string;
  created_at: string;
};

export function ScholarshipAdminRow({ scholarship: s }: { scholarship: RowData }) {
  const t = useTranslations('admin');
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(t('scholarships_delete_confirm', { name: s.name_en }))) return;
    startTransition(async () => {
      const result = await deleteScholarshipAction(s.id);
      if (!result.success) alert(`Error: ${result.error}`);
    });
  }

  return (
    <tr className="border-t border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 font-medium text-foreground">{s.name_en}</td>
      <td className="px-4 py-3 text-muted-foreground">{s.country}</td>
      <td className="px-4 py-3">
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border capitalize">
          {s.type}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/admin/scholarships/${s.id}/edit`}
            aria-label={`Edit ${s.name_en}`}
            className="text-xs text-primary hover:underline"
          >
            {t('edit')}
          </Link>
          <button
            onClick={handleDelete}
            disabled={isPending}
            aria-label={`Delete ${s.name_en}`}
            className="text-xs text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50"
          >
            {t('delete')}
          </button>
        </div>
      </td>
    </tr>
  );
}
