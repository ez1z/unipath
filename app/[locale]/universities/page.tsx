import { getTranslations } from 'next-intl/server';
import { getAll, getUniqueCountries, getUniqueLanguages, getUniqueMajors } from '@/lib/data/universities';
import { UniversityListClient } from '@/components/university/UniversityListClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type Props = { params: { locale: Locale } };

export default async function UniversitiesPage({ params: { locale } }: Props) {
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
          .select('dream_university_ids, desired_countries, desired_majors')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const savedUniversityIds: string[] = profileResult.data?.dream_university_ids ?? [];
  const userPrefs = user
    ? {
        countries: (profileResult.data?.desired_countries as string[] | null) ?? [],
        majors: (profileResult.data?.desired_majors as string[] | null) ?? [],
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
          userPrefs={userPrefs}
        />
      </div>
    </>
  );
}
