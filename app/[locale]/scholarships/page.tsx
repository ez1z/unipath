import { getTranslations } from 'next-intl/server';
import { getAll, getUniqueCountries, getUniqueTypes } from '@/lib/data/scholarships';
import { ScholarshipListClient } from '@/components/scholarship/ScholarshipListClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/constants';

export const dynamic = 'force-dynamic';

type Props = { params: { locale: Locale } };

export default async function ScholarshipsPage({ params: { locale } }: Props) {
  const t = await getTranslations('scholarships');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [scholarships, countries, types, profileResult] = await Promise.all([
    getAll(),
    getUniqueCountries(),
    getUniqueTypes(),
    user
      ? supabase
          .from('profiles')
          .select('interested_scholarship_ids, desired_countries')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const savedScholarshipIds: string[] = profileResult.data?.interested_scholarship_ids ?? [];
  const userPrefs = user
    ? { countries: (profileResult.data?.desired_countries as string[] | null) ?? [] }
    : null;

  return (
    <>
      <PageHeader title={t('title')} />
      <div className="container mx-auto px-4 py-8">
        <ScholarshipListClient
          scholarships={scholarships}
          locale={locale}
          countries={countries}
          types={types}
          savedScholarshipIds={savedScholarshipIds}
          userPrefs={userPrefs}
        />
      </div>
    </>
  );
}
