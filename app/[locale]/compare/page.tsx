import { useTranslations } from 'next-intl';
import { getAll } from '@/lib/data/universities';
import { CompareClient } from '@/components/university/CompareClient';
import { GulPattern } from '@/components/ui/GulPattern';
import type { Locale } from '@/lib/constants';

type Props = { params: { locale: Locale } };

export default function ComparePage({ params: { locale } }: Props) {
  const t = useTranslations('compare');
  const universities = getAll();

  return (
    <>
      <div className="bg-primary">
        <div className="container mx-auto px-4 py-10 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-primary-foreground">{t('title')}</h1>
            <p className="text-primary-foreground/60 mt-1 text-sm">{t('subtitle')}</p>
          </div>
          <GulPattern size={52} className="text-gold/40 hidden sm:block" />
        </div>
        <div className="h-1 flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-gold' : 'bg-tk-green'}`} />
          ))}
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <CompareClient universities={universities} locale={locale} />
      </div>
    </>
  );
}
