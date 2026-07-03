import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getAll, getUniqueCountries, getUniqueTypes } from '@/lib/data/scholarships';
import { getAll as getAllUniversities } from '@/lib/data/universities';
import { ScholarshipListClient } from '@/components/scholarship/ScholarshipListClient';
import { PageHeader } from '@/components/ui/PageHeader';
import { createClient } from '@/lib/supabase/server';
import { canonicalFor, localeAlternates } from '@/lib/seo';
import type { Locale } from '@/lib/constants';
import type { University } from '@/lib/data/university-types';

type TestEntry = { type: string; min_score?: number; min_math?: number; min_verbal?: number };

function meetsTestRequirements(
  university: University,
  scores: { toefl: number | null; ielts: number | null; sat: number | null; duolingo: number | null },
): boolean {
  const tests = Array.isArray(university.entrance_requirements?.tests)
    ? (university.entrance_requirements.tests as TestEntry[])
    : [];
  if (tests.length === 0) return true;
  return tests.some((test) => {
    if (test.type === 'toefl') return scores.toefl != null && scores.toefl >= (test.min_score ?? 0);
    if (test.type === 'ielts') return scores.ielts != null && scores.ielts >= (test.min_score ?? 0);
    if (test.type === 'sat') {
      if (scores.sat == null) return false;
      return scores.sat >= (test.min_math ?? 0) + (test.min_verbal ?? 0);
    }
    if (test.type === 'duolingo') return scores.duolingo != null && scores.duolingo >= (test.min_score ?? 0);
    return false;
  });
}

export const dynamic = 'force-dynamic';

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [scholarships, countries, types, profileResult, universities] = await Promise.all([
    getAll(),
    getUniqueCountries(),
    getUniqueTypes(),
    user
      ? supabase
          .from('profiles')
          .select('interested_scholarship_ids, desired_countries, toefl_total, ielts_overall, sat_total, duolingo_score')
          .eq('id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getAllUniversities(),
  ]);

  const savedScholarshipIds: string[] = profileResult.data?.interested_scholarship_ids ?? [];
  const userPrefs = user
    ? { countries: (profileResult.data?.desired_countries as string[] | null) ?? [] }
    : null;

  const userScores = user
    ? {
        toefl: (profileResult.data?.toefl_total as number | null) ?? null,
        ielts: (profileResult.data?.ielts_overall as number | null) ?? null,
        sat: (profileResult.data?.sat_total as number | null) ?? null,
        duolingo: (profileResult.data?.duolingo_score as number | null) ?? null,
      }
    : null;

  const hasAnyScore = userScores !== null &&
    (userScores.toefl != null || userScores.ielts != null ||
      userScores.sat != null || userScores.duolingo != null);

  const qualifiedUniversityIds = hasAnyScore && userScores
    ? universities.filter((u) => meetsTestRequirements(u, userScores)).map((u) => u.id)
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
          qualifiedUniversityIds={qualifiedUniversityIds}
        />
      </div>
    </>
  );
}
