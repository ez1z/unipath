import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getAll, getUniqueCountries, getUniqueTypes } from '@/lib/data/scholarships';
import { getAll as getAllUniversities } from '@/lib/data/universities';
import { ScholarshipListClient } from '@/components/scholarship/ScholarshipListClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { Suspense } from 'react';
import { orEmptyAtBuild } from '@/lib/data/build-fallback';
import { testsOf } from '@/lib/data/test-requirements';
import { canonicalFor, localeAlternates } from '@/lib/seo';
import type { Locale } from '@/lib/constants';

// Cached and refreshed at most hourly (ISR): crawlers and repeat visits no
// longer render the full list on Vercel. Saved scholarships, preferences and
// the "meets my scores" filter are worked out in the browser.
export const revalidate = 3600;

type Props = { params: { locale: Locale } };

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: t('scholarships_title'),
    description: t('scholarships_description'),
    alternates: {
      canonical: canonicalFor(locale, '/scholarships'),
      languages: localeAlternates('/scholarships'),
    },
  };
}

export default async function ScholarshipsPage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  const t = await getTranslations('scholarships');
  const [scholarships, countries, types, universities] = await orEmptyAtBuild(
    'Scholarships page',
    () => Promise.all([getAll(), getUniqueCountries(), getUniqueTypes(), getAllUniversities()]),
    [[], [], [], []],
  );

  // Only universities that list tests matter; the rest always qualify.
  const universityTests = universities
    .map((u) => ({ id: u.id, tests: testsOf(u) }))
    .filter((u) => u.tests.length > 0);

  return (
    <>
      <PageHeader title={t('title')} />
      <div className="container mx-auto px-4 py-8">
        {/* Ready for filters read from the URL, which a cached page only
            knows in the browser. */}
        <Suspense fallback={null}>
          <ScholarshipListClient
            scholarships={scholarships}
            locale={locale}
            countries={countries}
            types={types}
            universityTests={universityTests}
          />
        </Suspense>
      </div>
    </>
  );
}
