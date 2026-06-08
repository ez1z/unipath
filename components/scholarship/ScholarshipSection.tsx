import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getByUniversity } from '@/lib/data/scholarships';
import { ScholarshipCard } from './ScholarshipCard';
import type { Locale } from '@/lib/constants';

type Props = {
  universityId: string;
  country: string;
  locale: Locale;
};

export async function ScholarshipSection({ universityId, country, locale }: Props) {
  const t = await getTranslations('scholarships');
  const scholarships = await getByUniversity(universityId, country);

  return (
    <section className="mb-8">
      <h2 className="font-heading font-semibold text-base uppercase tracking-wider text-primary mb-3">
        {t('section_title')}
      </h2>

      {scholarships.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('none_listed')}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
            {scholarships.slice(0, 3).map((s) => (
              <ScholarshipCard key={s.id} scholarship={s} locale={locale} compact />
            ))}
          </div>
          <Link
            href={`/${locale}/scholarships?country=${encodeURIComponent(country)}`}
            className="text-sm font-medium text-tk-green hover:text-tk-green/80 transition-colors"
          >
            {t('view_all', { country })} →
          </Link>
        </>
      )}
    </section>
  );
}
