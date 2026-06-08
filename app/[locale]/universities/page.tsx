import { getTranslations } from 'next-intl/server';
import { getAll, getUniqueCountries, getUniqueLanguages, getUniqueMajors } from '@/lib/data/universities';
import { UniversityListClient } from '@/components/university/UniversityListClient';
import { GulPattern } from '@/components/ui/GulPattern';
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
      ? supabase.from('profiles').select('dream_university_ids').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const savedUniversityIds: string[] = profileResult.data?.dream_university_ids ?? [];

  return (
    <>
      <div className="bg-primary">
        <div className="container mx-auto px-4 py-10 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-primary-foreground">{t('title')}</h1>
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
        <UniversityListClient
          universities={universities}
          locale={locale}
          countries={countries}
          languages={languages}
          majors={majors}
          savedUniversityIds={savedUniversityIds}
        />
      </div>
    </>
  );
}
