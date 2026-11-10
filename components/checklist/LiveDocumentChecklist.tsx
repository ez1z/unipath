'use client';

import { useEffect, useState } from 'react';
import { DocumentChecklist } from '@/components/checklist/DocumentChecklist';
import { createClient } from '@/lib/supabase/client';
import { useViewerId } from '@/lib/viewer/useViewerId';
import { DocsDiffSchema, type DocsDiffMap } from '@/lib/docs/types';

type Props = {
  universityId: string;
  locale: string;
  entranceRequirements: Record<string, unknown>;
};

/**
 * The university page's checklist on a cached page.
 *
 * Everyone first gets the guest checklist (what the cached HTML holds). Once
 * the browser knows a student is signed in, their stored progress is loaded
 * and the checklist remounts as theirs, which adopts any local progress the
 * same way it did when the server passed it in.
 */
export function LiveDocumentChecklist({ universityId, locale, entranceRequirements }: Props) {
  const viewer = useViewerId();
  const [account, setAccount] = useState<{ userId: string; diffs: DocsDiffMap } | null>(null);

  useEffect(() => {
    if (!viewer.ready || !viewer.userId) return;
    const userId = viewer.userId;
    let alive = true;
    createClient()
      .from('document_progress')
      .select('university_id, checked, removed, custom')
      .eq('user_id', userId)
      .eq('university_id', universityId)
      .then(({ data, error }) => {
        if (!alive || error) return;
        const diffs: DocsDiffMap = {};
        for (const row of data ?? []) {
          const parsed = DocsDiffSchema.safeParse(row);
          if (parsed.success) diffs[row.university_id as string] = parsed.data;
        }
        setAccount({ userId, diffs });
      });
    return () => {
      alive = false;
    };
  }, [viewer.ready, viewer.userId, universityId]);

  if (account) {
    return (
      <DocumentChecklist
        key={account.userId}
        universityId={universityId}
        locale={locale}
        isSignedIn
        entranceRequirements={entranceRequirements}
        initialDiffs={account.diffs}
      />
    );
  }

  return (
    <DocumentChecklist
      key="guest"
      universityId={universityId}
      locale={locale}
      isSignedIn={false}
      entranceRequirements={entranceRequirements}
      initialDiffs={{}}
    />
  );
}
