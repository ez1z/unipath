'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { parseMessage } from '@/lib/discussions/linkify';
import { useDiscussion } from './context';

type Props = { body: string; isDeleted: boolean };

export function MessageBody({ body, isDeleted }: Props) {
  const t = useTranslations('discussions');
  const { locale, openLink } = useDiscussion();

  if (isDeleted) {
    return <p className="text-sm italic text-muted-foreground">{t('removed')}</p>;
  }

  const segments = parseMessage(body);
  return (
    <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.type === 'text') return <span key={i}>{seg.value}</span>;
        if (seg.type === 'mention') {
          const base = seg.entityType === 'university' ? 'universities' : 'scholarships';
          return (
            <Link
              key={i}
              href={`/${locale}/${base}/${seg.slug}`}
              className="font-medium text-primary hover:text-primary/80"
            >
              @{seg.name}
            </Link>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => openLink(seg.value)}
            className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
          >
            {seg.value}
          </button>
        );
      })}
    </p>
  );
}
