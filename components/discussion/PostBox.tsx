'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { postMessageAction } from '@/app/[locale]/discussions/actions';
import { createClient } from '@/lib/supabase/client';
import { buildMentionToken } from '@/lib/discussions/linkify';
import { useDiscussion } from './context';

type Props = {
  parentId?: string | null;
  onDone?: () => void;
  autoFocus?: boolean;
};

type MentionItem = { kind: 'university' | 'scholarship'; slug: string; name: string };

export function PostBox({ parentId = null, onDone, autoFocus = false }: Props) {
  const t = useTranslations('discussions');
  const router = useRouter();
  const { locale, entityType, entityId, viewer } = useDiscussion();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionsEnabled = entityType === 'general';
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<MentionItem[]>([]);

  // Debounced search for @mention suggestions.
  useEffect(() => {
    if (!mentionsEnabled || query === null || query.length < 1) {
      setResults([]);
      return;
    }
    const safe = query.replace(/[%,()\\]/g, '').trim();
    if (!safe) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const supabase = createClient();
      const cols = 'slug, name_en, name_ru, name_tk';
      const filter = `name_en.ilike.%${safe}%,name_ru.ilike.%${safe}%,name_tk.ilike.%${safe}%`;
      const [{ data: unis }, { data: schs }] = await Promise.all([
        supabase.from('universities').select(cols).or(filter).limit(5),
        supabase.from('scholarships').select(cols).or(filter).eq('is_active', true).limit(5),
      ]);
      const pick = (r: Record<string, string>) => r[`name_${locale}`] ?? r.name_en;
      setResults([
        ...(unis ?? []).map((r) => ({ kind: 'university' as const, slug: r.slug, name: pick(r) })),
        ...(schs ?? []).map((r) => ({ kind: 'scholarship' as const, slug: r.slug, name: pick(r) })),
      ]);
    }, 200);
    return () => clearTimeout(handle);
  }, [query, mentionsEnabled, locale]);

  function detectQuery(value: string, caret: number) {
    if (!mentionsEnabled) return;
    const before = value.slice(0, caret);
    const m = before.match(/@(\w{1,30})$/);
    setQuery(m ? m[1] : null);
  }

  function insertMention(item: MentionItem) {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? body.length;
    const before = body.slice(0, caret);
    const atIdx = before.lastIndexOf('@');
    if (atIdx < 0) return;
    const token = buildMentionToken(item.kind, item.slug, item.name) + ' ';
    const next = body.slice(0, atIdx) + token + body.slice(caret);
    setBody(next);
    setQuery(null);
    setResults([]);
    requestAnimationFrame(() => {
      const pos = atIdx + token.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  if (!viewer.authed) {
    return (
      <p className="text-sm text-muted-foreground">
        <Link href={`/${locale}/auth/signin`} className="text-primary font-medium underline underline-offset-2">
          {t('signin_to_post')}
        </Link>
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const r = await postMessageAction(locale, { entityType, entityId, parentId, body: trimmed });
      if (r.success) {
        setBody('');
        setQuery(null);
        onDone?.();
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  const showDropdown = mentionsEnabled && query !== null && results.length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            detectQuery(e.target.value, e.target.selectionStart);
          }}
          onKeyUp={(e) => detectQuery(e.currentTarget.value, e.currentTarget.selectionStart)}
          onClick={(e) => detectQuery(e.currentTarget.value, e.currentTarget.selectionStart)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query !== null) {
              e.preventDefault();
              setQuery(null);
            }
          }}
          placeholder={
            mentionsEnabled
              ? t('post_placeholder_mention')
              : parentId
                ? t('reply_placeholder')
                : t('post_placeholder')
          }
          maxLength={4000}
          rows={parentId ? 2 : 3}
          autoFocus={autoFocus}
          aria-label={parentId ? t('reply_placeholder') : t('post_placeholder')}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
        {showDropdown && (
          <ul
            className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-card border border-border rounded-lg shadow-card-hover"
            role="listbox"
            aria-label={t('mention_list')}
          >
            {results.map((item) => (
              <li key={`${item.kind}:${item.slug}`}>
                <button
                  type="button"
                  onClick={() => insertMention(item)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                >
                  <span className="truncate text-foreground">{item.name}</span>
                  <span className="flex-shrink-0 text-xs text-muted-foreground">
                    {item.kind === 'university' ? t('mention_type_university') : t('mention_type_scholarship')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{viewer.displayName}</span>
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
    </form>
  );
}
