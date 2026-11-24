'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useViewerId } from './useViewerId';

/**
 * The signed-in user's profile columns, read in the browser after mount, so
 * the list pages can be cached (ISR) and shared by every visitor.
 *
 * Returns null for guests and while loading, and an empty object for a
 * signed-in user without a profile row.
 */
export function useViewerProfile<T extends Record<string, unknown>>(columns: string): T | null {
  const viewer = useViewerId();
  const [profile, setProfile] = useState<T | null>(null);

  useEffect(() => {
    if (!viewer.ready || !viewer.userId) return;
    let alive = true;
    createClient()
      .from('profiles')
      .select(columns)
      .eq('id', viewer.userId)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (alive) setProfile(((data as unknown) as T | null) ?? ({} as T));
        },
        () => {
          // Leave the guest view.
        },
      );
    return () => {
      alive = false;
    };
  }, [viewer.ready, viewer.userId, columns]);

  return profile;
}
