'use client';

import { useTranslations } from 'next-intl';
import { linkify } from '@/lib/discussions/linkify';
import { useDiscussion } from './context';

type Props = { body: string; isDeleted: boolean };

export function MessageBody({ body, isDeleted }: Props) {
  const t = useTranslations('discussions');
  const { openLink } = useDiscussion();

  if (isDeleted) {
    return <p className="text-sm italic text-muted-foreground">{t('removed')}</p>;
  }

  const segments = linkify(body);
  return (
    <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
      {segments.map((seg, i) =>
        seg.type === 'text' ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <button
            key={i}
            type="button"
            onClick={() => openLink(seg.value)}
            className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
          >
            {seg.value}
          </button>
        ),
      )}
    </p>
  );
}
