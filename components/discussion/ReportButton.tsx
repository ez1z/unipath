'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { reportMessageAction } from '@/app/[locale]/discussions/actions';
import { useDiscussion } from './context';

export function ReportButton({ messageId }: { messageId: string }) {
  const t = useTranslations('discussions');
  const { locale, viewer } = useDiscussion();
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!viewer.authed) return null;
  if (done) return <span className="text-xs text-muted-foreground">{t('reported')}</span>;

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          await reportMessageAction(locale, { messageId });
          setDone(true);
        })
      }
      disabled={isPending}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
    >
      {t('report')}
    </button>
  );
}
