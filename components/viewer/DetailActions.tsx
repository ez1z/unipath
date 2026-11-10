'use client';

import { useEffect, useState } from 'react';
import { BookmarkButton } from '@/components/profile/BookmarkButton';
import { createClient } from '@/lib/supabase/client';
import { useViewerId } from '@/lib/viewer/useViewerId';
import type { Locale } from '@/lib/constants';

type Props = {
  type: 'university' | 'scholarship';
  id: string;
  locale: Locale;
  editHref: string;
};

const SAVED_COLUMN = {
  university: 'dream_university_ids',
  scholarship: 'interested_scholarship_ids',
} as const;

/**
 * The personal part of a detail page's action row: the admin "Edit" link and
 * the bookmark's saved state. Loaded in the browser so the page around it can
 * be cached and shared by every visitor.
 */
export function DetailActions({ type, id, locale, editHref }: Props) {
  const viewer = useViewerId();
  const [isSaved, setIsSaved] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!viewer.ready || !viewer.userId) return;
    let alive = true;
    const supabase = createClient();
    const column = SAVED_COLUMN[type];
    Promise.all([
      supabase.from('profiles').select(column).eq('id', viewer.userId).maybeSingle(),
      supabase.from('admins').select('role').eq('user_id', viewer.userId).maybeSingle(),
    ])
      .then(([{ data: profile }, { data: admin }]) => {
        if (!alive) return;
        const ids = ((profile as Record<string, string[] | null> | null)?.[column] ?? []) as string[];
        setIsSaved(ids.includes(id));
        setIsAdmin(!!admin);
      })
      .catch(() => {
        // Leave the guest defaults: not saved, not admin.
      });
    return () => {
      alive = false;
    };
  }, [viewer.ready, viewer.userId, type, id]);

  return (
    <>
      {isAdmin && (
        <a
          href={editHref}
          className="flex-1 px-5 py-3 border-2 border-dashed border-muted-foreground/40 text-muted-foreground rounded-lg text-sm font-semibold text-center hover:border-primary hover:text-primary transition-colors"
          aria-label="Edit in admin panel"
        >
          ✏ Edit
        </a>
      )}
      {/* Keyed on the saved state so the button picks it up once it loads. */}
      <BookmarkButton
        key={isSaved ? 'saved' : 'not-saved'}
        type={type}
        id={id}
        initialSaved={isSaved}
        locale={locale}
        size="detail"
      />
    </>
  );
}
