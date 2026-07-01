'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/lib/constants';
import type { DiscussionMessage, EntityType } from '@/lib/data/discussion-types';
import { toHref } from '@/lib/discussions/linkify';
import { setNicknameAction, dismissNicknamePromptAction } from '@/app/[locale]/discussions/actions';
import { DiscussionProvider, type ClientViewer } from './context';
import { PostBox } from './PostBox';
import { MessageItem } from './MessageItem';
import { NicknameDialog } from './NicknameDialog';
import { LinkWarningDialog } from './LinkWarningDialog';

type Props = {
  locale: Locale;
  entityType: EntityType;
  entityId: string;
  messages: DiscussionMessage[];
  viewer: ClientViewer;
  isSuperuser: boolean;
};

type Sort = 'top' | 'new';

function sortTree(list: DiscussionMessage[], sort: Sort): DiscussionMessage[] {
  const cmp =
    sort === 'top'
      ? (a: DiscussionMessage, b: DiscussionMessage) =>
          b.score - a.score || b.createdAt.localeCompare(a.createdAt)
      : (a: DiscussionMessage, b: DiscussionMessage) => b.createdAt.localeCompare(a.createdAt);
  return [...list]
    .sort(cmp)
    .map((n) => ({ ...n, children: sortTree(n.children, sort) }));
}

export function DiscussionThread({ locale, entityType, entityId, messages, viewer, isSuperuser }: Props) {
  const t = useTranslations('discussions');
  const router = useRouter();
  const [sort, setSort] = useState<Sort>('top');
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [nickError, setNickError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showPrompt, setShowPrompt] = useState(
    viewer.authed && !viewer.nickname && !viewer.promptDismissed,
  );

  const sorted = useMemo(() => sortTree(messages, sort), [messages, sort]);

  function savePromptNickname(nickname: string) {
    setNickError(null);
    startTransition(async () => {
      const r = await setNicknameAction(locale, nickname);
      if (r.success) {
        setShowPrompt(false);
        router.refresh();
      } else {
        setNickError(r.error);
      }
    });
  }

  function skipPrompt() {
    startTransition(async () => {
      await dismissNicknamePromptAction();
      setShowPrompt(false);
      router.refresh();
    });
  }

  return (
    <DiscussionProvider
      value={{ locale, entityType, entityId, viewer, isSuperuser, openLink: setLinkUrl }}
    >
      <div className="space-y-5">
        <div className="bg-card border border-border rounded-xl p-4">
          <PostBox />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t('count', { count: countMessages(messages) })}
          </span>
          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setSort('top')}
              aria-pressed={sort === 'top'}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${sort === 'top' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('sort_top')}
            </button>
            <button
              type="button"
              onClick={() => setSort('new')}
              aria-pressed={sort === 'new'}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${sort === 'new' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('sort_new')}
            </button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{t('empty')}</p>
        ) : (
          <div className="divide-y divide-border">
            {sorted.map((m) => (
              <MessageItem key={m.id} message={m} depth={0} />
            ))}
          </div>
        )}
      </div>

      {showPrompt && (
        <NicknameDialog
          mode="prompt"
          busy={isPending}
          error={nickError}
          onConfirm={savePromptNickname}
          onSecondary={skipPrompt}
          onClose={skipPrompt}
        />
      )}

      {linkUrl && (
        <LinkWarningDialog
          url={linkUrl}
          onCancel={() => setLinkUrl(null)}
          onConfirm={() => {
            window.open(toHref(linkUrl), '_blank', 'noopener,noreferrer');
            setLinkUrl(null);
          }}
        />
      )}
    </DiscussionProvider>
  );
}

function countMessages(list: DiscussionMessage[]): number {
  let n = 0;
  for (const m of list) {
    if (!m.isDeleted) n += 1;
    n += countMessages(m.children);
  }
  return n;
}
