'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { formatDate } from '@/lib/format';
import type { DiscussionMessage } from '@/lib/data/discussion-types';
import { deleteMessageAction } from '@/app/[locale]/discussions/actions';
import { useDiscussion } from './context';
import { MessageBody } from './MessageBody';
import { VoteButtons } from './VoteButtons';
import { ReportButton } from './ReportButton';
import { PostBox } from './PostBox';

// Cap the visual indent so deep threads stay readable on mobile.
const MAX_INDENT_DEPTH = 5;

function countDescendants(list: DiscussionMessage[]): number {
  let n = 0;
  for (const m of list) n += 1 + countDescendants(m.children);
  return n;
}

export function MessageItem({ message, depth }: { message: DiscussionMessage; depth: number }) {
  const t = useTranslations('discussions');
  const router = useRouter();
  const { locale, viewer, isSuperuser } = useDiscussion();
  const [replying, setReplying] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const indented = depth > 0;
  const descendants = countDescendants(message.children);

  function handleDelete() {
    startTransition(async () => {
      await deleteMessageAction(locale, message.id);
      router.refresh();
    });
  }

  // Collapsed: single compact header line, reddit-style.
  if (collapsed) {
    return (
      <div className={indented ? 'pl-3 sm:pl-4 border-l-2 border-border' : ''}>
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label={t('expand_thread')}
            aria-expanded={false}
            className="w-5 h-5 flex items-center justify-center rounded border border-border hover:bg-muted transition-colors text-foreground"
          >
            +
          </button>
          <span className="font-semibold text-foreground">{message.authorLabel}</span>
          {descendants > 0 && <span>{t('collapsed_replies', { count: descendants })}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className={indented ? 'pl-3 sm:pl-4 border-l-2 border-border' : ''}>
      <div className="flex gap-2 py-2">
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label={t('collapse_thread')}
            aria-expanded={true}
            className="w-5 h-5 flex items-center justify-center rounded border border-border hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            −
          </button>
          <VoteButtons messageId={message.id} initialScore={message.score} initialVote={message.viewerVote} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="font-semibold text-foreground">{message.authorLabel}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={message.createdAt}>{formatDate(new Date(message.createdAt))}</time>
          </div>

          <MessageBody body={message.body} isDeleted={message.isDeleted} />

          {!message.isDeleted && (
            <div className="flex items-center gap-3 mt-1.5">
              {viewer.authed && (
                <button
                  type="button"
                  onClick={() => setReplying((v) => !v)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('reply')}
                </button>
              )}
              <ReportButton messageId={message.id} />
              {isSuperuser && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-xs font-medium text-primary/80 hover:text-primary transition-colors disabled:opacity-50"
                >
                  {isPending ? '…' : t('delete')}
                </button>
              )}
            </div>
          )}

          {replying && (
            <div className="mt-2">
              <PostBox
                parentId={message.id}
                autoFocus
                onDone={() => setReplying(false)}
              />
            </div>
          )}
        </div>
      </div>

      {message.children.length > 0 && (
        <div className={depth < MAX_INDENT_DEPTH ? 'ml-3 sm:ml-5' : ''}>
          {message.children.map((child) => (
            <MessageItem key={child.id} message={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
