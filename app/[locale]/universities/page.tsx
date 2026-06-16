import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getAll, getUniqueCountries, getUniqueLanguages, getUniqueMajors } from '@/lib/data/universities';
import { getScholarshipEligibleUniversityIds } from '@/lib/data/scholarships';
import { UniversityListClient } from '@/components/university/UniversityListClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type Props = { params: { locale: Locale } };

export default async function UniversitiesPage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  const t = await getTranslations('universities');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [universities, countries, languages, majors, profileResult] = await Promise.all([
    getAll(),
    getUniqueCountries(),
    getUniqueLanguages(),
    getUniqueMajors(),
    user
      ? supabase
          .from('profiles')
          .select('dream_university_ids, desired_countries, desired_majors, toefl_total, ielts_overall, sat_total, duolingo_score')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const scholarshipEligibleIds = await getScholarshipEligibleUniversityIds(universities);

  const savedUniversityIds: string[] = profileResult.data?.dream_university_ids ?? [];
  const userPrefs = user
    ? {
        countries: (profileResult.data?.desired_countries as string[] | null) ?? [],
        majors: (profileResult.data?.desired_majors as string[] | null) ?? [],
      }
    : null;
  const userScores = user
    ? {
        toefl: (profileResult.data?.toefl_total as number | null) ?? null,
        ielts: (profileResult.data?.ielts_overall as number | null) ?? null,
        sat: (profileResult.data?.sat_total as number | null) ?? null,
        duolingo: (profileResult.data?.duolingo_score as number | null) ?? null,
      }
    : null;

  return (
    <>
      <PageHeader title={t('title')} />
      <div className="container mx-auto px-4 py-8">
        <UniversityListClient
          universities={universities}
          locale={locale}
          countries={countries}
          languages={languages}
          majors={majors}
          savedUniversityIds={savedUniversityIds}
          scholarshipEligibleIds={scholarshipEligibleIds}
          userPrefs={userPrefs}
          userScores={userScores}
        />
      </div>
    </>
  );
}
