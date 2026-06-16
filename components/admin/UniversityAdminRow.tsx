'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import {
  deleteUniversityAction,
  toggleMoeApprovedAction,
} from '@/app/admin/universities/actions';

type RowData = {
  id: string;
  name_en: string;
  country: string;
  moe_approved: boolean;
  created_at: string;
};

type Props = {
  university: RowData;
  selected: boolean;
  onToggle: () => void;
};

export function UniversityAdminRow({ university: u, selected, onToggle }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete "${u.name_en}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteUniversityAction(u.id);
      if (!result.success) alert(`Error: ${result.error}`);
    });
  }

  function handleToggleMoe() {
    startTransition(async () => {
      const result = await toggleMoeApprovedAction(u.id, u.moe_approved);
      if (!result.success) alert(`Error: ${result.error}`);
    });
  }

  return (
    <tr className={`border-t border-border hover:bg-muted/30 transition-colors ${selected ? 'bg-primary/5' : ''}`}>
      <td className="px-4 py-3 w-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${u.name_en}`}
          className="rounded border-border accent-primary cursor-pointer"
        />
      </td>
      <td className="px-4 py-3 font-medium text-foreground">{u.name_en}</td>
      <td className="px-4 py-3 text-muted-foreground">{u.country}</td>
      <td className="px-4 py-3">
        <button
          onClick={handleToggleMoe}
          disabled={isPending}
          aria-label={`Toggle MoE approved for ${u.name_en}`}
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
            u.moe_approved
              ? 'bg-yellow-50 text-yellow-700 border-yellow-300 hover:bg-yellow-100'
              : 'bg-muted text-muted-foreground border-border hover:bg-muted/60'
          } disabled:opacity-50`}
        >
          {u.moe_approved ? "★ Approved" : "Not approved"}
        </button>
      </td>
      <td className="px-4 py-3 text-muted-foreground text-sm">
        {formatDate(new Date(u.created_at))}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/admin/universities/${u.id}/edit`}
            aria-label={`Edit ${u.name_en}`}
            className="text-xs text-primary hover:underline"
          >
            {"Edit"}
          </Link>
          <button
            onClick={handleDelete}
            disabled={isPending}
            aria-label={`Delete ${u.name_en}`}
            className="text-xs text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50"
          >
            {"Delete"}
          </button>
        </div>
      </td>
    </tr>
  );
}
