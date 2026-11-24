import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getAll, getUniqueCountries, getUniqueLanguages, getUniqueMajors } from '@/lib/data/universities';
import { getScholarshipEligibleUniversityIds } from '@/lib/data/scholarships';
import { UniversityListClient } from '@/components/university/UniversityListClient';
import { UniversityCard } from '@/components/university/UniversityCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Suspense } from 'react';
import { orEmptyAtBuild } from '@/lib/data/build-fallback';
import { canonicalFor, localeAlternates } from '@/lib/seo';
import type { Locale } from '@/lib/constants';

// Cached and refreshed at most hourly (ISR), like the detail pages: crawlers
// and repeat visits no longer render the full list of universities on Vercel.
// Saved universities, preferences and scores load in the browser.
export const revalidate = 3600;

type Props = { params: { locale: Locale } };

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: t('universities_title'),
    description: t('universities_description'),
    alternates: {
      canonical: canonicalFor(locale, '/universities'),
      languages: localeAlternates('/universities'),
    },
  };
}

export default async function UniversitiesPage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  const t = await getTranslations('universities');
  const { universities, countries, languages, majors, scholarshipEligibleIds } = await orEmptyAtBuild(
    'Universities page',
    async () => {
      const [universities, countries, languages, majors] = await Promise.all([
        getAll(),
        getUniqueCountries(),
        getUniqueLanguages(),
        getUniqueMajors(),
      ]);
      const scholarshipEligibleIds = await getScholarshipEligibleUniversityIds(universities);
      return { universities, countries, languages, majors, scholarshipEligibleIds };
    },
    { universities: [], countries: [], languages: [], majors: [], scholarshipEligibleIds: [] },
  );

  const eligible = new Set(scholarshipEligibleIds);

  return (
    <>
      <PageHeader title={t('title')} />
      <div className="container mx-auto px-4 py-8">
        {/* The list reads its filters from the URL, which a cached page only
            knows in the browser. Until it loads, the HTML carries the
            unfiltered cards, so crawlers and slow connections still see them. */}
        <Suspense
          fallback={
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {universities.map((u) => (
                <UniversityCard
                  key={u.id}
                  university={u}
                  locale={locale}
                  hasScholarships={eligible.has(u.id)}
                />
              ))}
            </div>
          }
        >
          <UniversityListClient
            universities={universities}
            locale={locale}
            countries={countries}
            languages={languages}
            majors={majors}
            scholarshipEligibleIds={scholarshipEligibleIds}
          />
        </Suspense>
      </div>
    </>
  );
}
