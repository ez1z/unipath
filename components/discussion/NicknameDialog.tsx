'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  mode: 'prompt' | 'post';
  busy?: boolean;
  error?: string | null;
  onConfirm: (nickname: string) => void;
  onSecondary: () => void;
  onClose: () => void;
};

export function NicknameDialog({ mode, busy = false, error, onConfirm, onSecondary, onClose }: Props) {
  const t = useTranslations('discussions');
  const [value, setValue] = useState('');
  const trimmed = value.trim();
  const valid = trimmed.length >= 2 && trimmed.length <= 30;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && !busy) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('nickname_title')}
      onClick={handleBackdropClick}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold text-base">{t('nickname_title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('nickname_body')}</p>
        </div>
        <div className="p-5">
          <label htmlFor="nickname-input" className="sr-only">
            {t('nickname_label')}
          </label>
          <input
            id="nickname-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t('nickname_placeholder')}
            maxLength={30}
            autoFocus
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>
        <div className="p-4 border-t border-border flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onSecondary}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            {mode === 'prompt' ? t('nickname_skip') : t('nickname_use_email')}
          </button>
          <button
            type="button"
            onClick={() => valid && onConfirm(trimmed)}
            disabled={!valid || busy}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {busy ? '…' : mode === 'prompt' ? t('nickname_save') : t('nickname_set_post')}
          </button>
        </div>
      </div>
    </div>
  );
}
