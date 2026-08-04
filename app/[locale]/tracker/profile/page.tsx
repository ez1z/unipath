import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import type { Locale } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import { getAll, getUniqueMajors } from '@/lib/data/universities';
import { getAll as getAllScholarships } from '@/lib/data/scholarships';
import { getDocsDiffs } from '@/lib/data/docs';
import { ProfileForm } from './ProfileForm';
import { ProfileChecklistSummary } from '@/components/checklist/ProfileChecklistSummary';
import { PageHeader } from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'profile' });
  return { title: `${t('title')} — UniPath` };
}

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/auth/signin?next=/${locale}/tracker/profile`);
  }

  const [profileResult, universities, majors, scholarships] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    getAll(),
    getUniqueMajors(),
    getAllScholarships(),
  ]);

  const profile = profileResult.data ?? null;

  const dreamUniIds = (profile?.dream_university_ids as string[] | null) ?? [];
  const dreamUniversities = universities.filter((u) => dreamUniIds.includes(u.id));
  const docsDiffs = await getDocsDiffs(dreamUniIds);

  const t = await getTranslations({ locale, namespace: 'profile' });

  const defaultDisplayName =
    (profile?.display_name as string | null) ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    '';

  return (
    <>
      <PageHeader title={t('title')} />

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <ProfileForm
          locale={locale}
          profile={profile}
          universities={universities}
          majors={majors}
          scholarships={scholarships}
          defaultDisplayName={defaultDisplayName}
        />
        <ProfileChecklistSummary
          dreamUniversities={dreamUniversities}
          docsDiffs={docsDiffs}
          locale={locale}
        />
      </div>
    </>
  );
}
