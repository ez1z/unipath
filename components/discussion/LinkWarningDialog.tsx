'use client';

import { useTranslations } from 'next-intl';

type Props = {
  url: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function LinkWarningDialog({ url, onCancel, onConfirm }: Props) {
  const t = useTranslations('discussions');

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('link_warning_title')}
      onClick={handleBackdropClick}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <span aria-hidden="true">⚠️</span> {t('link_warning_title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">{t('link_warning_body')}</p>
          <p className="mt-3 text-sm font-mono break-all bg-muted rounded-lg px-3 py-2 text-foreground">
            {url}
          </p>
        </div>
        <div className="p-4 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
          >
            {t('link_warning_cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
          >
            {t('link_warning_continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
