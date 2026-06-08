'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  toggleUniversityBookmark,
  toggleScholarshipBookmark,
} from '@/lib/actions/bookmarks';
import type { Locale } from '@/lib/constants';

type Props = {
  type: 'university' | 'scholarship';
  id: string;
  initialSaved: boolean;
  locale: Locale;
  /** 'card' = icon only; 'detail' = icon + label */
  size?: 'card' | 'detail';
};

export function BookmarkButton({ type, id, initialSaved, locale, size = 'card' }: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const tUni = useTranslations('universities');
  const tSch = useTranslations('scholarships');

  const t = type === 'university' ? tUni : tSch;
  const addLabel = t('bookmark_add_label');
  const removeLabel = t('bookmark_remove_label');
  const addText = t('bookmark_add');
  const savedText = t('bookmark_saved');

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    startTransition(async () => {
      const action =
        type === 'university' ? toggleUniversityBookmark : toggleScholarshipBookmark;
      const result = await action(id, locale);

      if ('unauthenticated' in result) {
        router.push(`/${locale}/auth/signin`);
        return;
      }
      setSaved(result.saved);
    });
  }

  if (size === 'detail') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-label={saved ? removeLabel : addLabel}
        className={`inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold border-2 transition-colors disabled:opacity-50 ${
          saved
            ? 'bg-gold/10 border-gold text-gold-dark hover:bg-gold/20'
            : 'border-border text-foreground hover:border-gold hover:text-gold-dark'
        }`}
      >
        <HeartIcon filled={saved} />
        {saved ? savedText : addText}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label={saved ? removeLabel : addLabel}
      title={saved ? removeLabel : addLabel}
      className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full border transition-colors disabled:opacity-50 ${
        saved
          ? 'bg-gold/10 border-gold/40 text-gold hover:bg-gold/20'
          : 'bg-card border-border text-muted-foreground hover:border-gold hover:text-gold'
      }`}
    >
      <HeartIcon filled={saved} size={14} />
    </button>
  );
}

function HeartIcon({ filled, size = 16 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
