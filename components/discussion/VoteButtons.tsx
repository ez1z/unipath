'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { voteAction } from '@/app/[locale]/discussions/actions';
import { useDiscussion } from './context';

type Props = {
  messageId: string;
  initialScore: number;
  initialVote: -1 | 0 | 1;
};

export function VoteButtons({ messageId, initialScore, initialVote }: Props) {
  const t = useTranslations('discussions');
  const { locale, viewer } = useDiscussion();
  const [vote, setVote] = useState<-1 | 0 | 1>(initialVote);
  const [score, setScore] = useState(initialScore);
  const [, startTransition] = useTransition();

  function cast(next: -1 | 1) {
    if (!viewer.authed) return;
    const newVote: -1 | 0 | 1 = vote === next ? 0 : next;
    const prevVote = vote;
    const prevScore = score;
    setVote(newVote);
    setScore(score - prevVote + newVote);
    startTransition(async () => {
      const r = await voteAction(locale, { messageId, value: newVote });
      if (!r.success) {
        setVote(prevVote);
        setScore(prevScore);
      }
    });
  }

  const base =
    'w-6 h-6 flex items-center justify-center rounded transition-colors disabled:opacity-40';
  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      <button
        type="button"
        onClick={() => cast(1)}
        disabled={!viewer.authed}
        aria-label={t('upvote')}
        aria-pressed={vote === 1}
        className={`${base} ${vote === 1 ? 'text-gold' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <span className={`text-xs font-semibold tabular-nums ${vote === 1 ? 'text-gold' : vote === -1 ? 'text-primary' : 'text-muted-foreground'}`}>
        {score}
      </span>
      <button
        type="button"
        onClick={() => cast(-1)}
        disabled={!viewer.authed}
        aria-label={t('downvote')}
        aria-pressed={vote === -1}
        className={`${base} ${vote === -1 ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  );
}
