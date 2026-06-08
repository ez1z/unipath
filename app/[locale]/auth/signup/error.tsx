'use client';

import { useTranslations } from 'next-intl';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('common');
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-4 text-foreground">{t('error_title')}</h2>
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
        >
          {t('error_retry')}
        </button>
      </div>
    </div>
  );
}
