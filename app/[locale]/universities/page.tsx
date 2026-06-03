import { useTranslations } from 'next-intl';
import { getAll, getUniqueCountries, getUniqueLanguages, getUniqueMajors } from '@/lib/data/universities';
import { UniversityListClient } from '@/components/university/UniversityListClient';
import { GulPattern } from '@/components/ui/GulPattern';
import type { Locale } from '@/lib/constants';

type Props = { params: { locale: Locale } };

export default function UniversitiesPage({ params: { locale } }: Props) {
  const t = useTranslations('universities');
  const universities = getAll();
  const countries = getUniqueCountries();
  const languages = getUniqueLanguages();
  const majors = getUniqueMajors();

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
        />
      </div>
    </>
  );
}
