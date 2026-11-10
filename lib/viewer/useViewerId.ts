'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type ViewerId = { ready: false; userId: null } | { ready: true; userId: string | null };

/**
 * The signed-in user's id, read in the browser after mount.
 *
 * Cached (ISR) pages are the same HTML for everyone, so anything personal
 * (saved state, admin links, checklist progress) is filled in on the client.
 * The session comes from the auth cookie, so this needs no network call in
 * the usual case; every query made with it is still checked by RLS.
 */
export function useViewerId(): ViewerId {
  const [state, setState] = useState<ViewerId>({ ready: false, userId: null });

  useEffect(() => {
    let alive = true;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (alive) setState({ ready: true, userId: data.session?.user.id ?? null });
      })
      .catch(() => {
        if (alive) setState({ ready: true, userId: null });
      });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
