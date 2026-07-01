'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { postMessageAction } from '@/app/[locale]/discussions/actions';
import { useDiscussion } from './context';
import { NicknameDialog } from './NicknameDialog';

type Props = {
  parentId?: string | null;
  onDone?: () => void;
  autoFocus?: boolean;
};

export function PostBox({ parentId = null, onDone, autoFocus = false }: Props) {
  const t = useTranslations('discussions');
  const router = useRouter();
  const { locale, entityType, entityId, viewer } = useDiscussion();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showNickname, setShowNickname] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!viewer.authed) {
    return (
      <p className="text-sm text-muted-foreground">
        <Link href={`/${locale}/auth/signin`} className="text-primary font-medium underline underline-offset-2">
          {t('signin_to_post')}
        </Link>
      </p>
    );
  }

  function submit(setNickname?: string) {
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const r = await postMessageAction(locale, {
        entityType,
        entityId,
        parentId,
        body: trimmed,
        setNickname,
      });
      if (r.success) {
        setBody('');
        setShowNickname(false);
        onDone?.();
        router.refresh();
      } else {
        setError(r.error);
        setShowNickname(false);
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    // Gate: no nickname yet and prompt not dismissed → ask before posting.
    if (!viewer.nickname && !viewer.promptDismissed) {
      setShowNickname(true);
      return;
    }
    submit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={parentId ? t('reply_placeholder') : t('post_placeholder')}
        maxLength={4000}
        rows={parentId ? 2 : 3}
        autoFocus={autoFocus}
        aria-label={parentId ? t('reply_placeholder') : t('post_placeholder')}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {viewer.nickname ? `@${viewer.nickname}` : viewer.maskedEmail}
        </span>
        <div className="flex gap-2">
          {onDone && (
            <button
              type="button"
              onClick={onDone}
              className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
            >
              {t('cancel')}
            </button>
          )}
          <button
            type="submit"
            disabled={!body.trim() || isPending}
            className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isPending ? '…' : parentId ? t('reply_submit') : t('post_submit')}
          </button>
        </div>
      </div>

      {showNickname && (
        <NicknameDialog
          mode="post"
          busy={isPending}
          error={error}
          onConfirm={(nick) => submit(nick)}
          onSecondary={() => submit()}
          onClose={() => setShowNickname(false)}
        />
      )}
    </form>
  );
}
