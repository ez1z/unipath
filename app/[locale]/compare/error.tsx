'use client';

import { useTranslations } from 'next-intl';

export default function ListError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('common');
  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h2 className="text-2xl font-bold mb-4">{t('error_title')}</h2>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
      >
        {t('error_retry')}
      </button>
    </div>
  );
}
