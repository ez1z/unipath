import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import type { Locale } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import { getAll, getUniqueMajors } from '@/lib/data/universities';
import { getAll as getAllScholarships } from '@/lib/data/scholarships';
import { ProfileForm } from './ProfileForm';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'profile' });
  return { title: `${t('title')} — UniPath` };
}

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;

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
  const t = await getTranslations({ locale, namespace: 'profile' });

  const defaultDisplayName =
    (profile?.display_name as string | null) ??
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    '';

  return (
    <>
      <div className="bg-primary">
        <div className="container mx-auto px-4 py-10">
          <h1 className="font-heading text-3xl font-bold text-primary-foreground">
            {t('title')}
          </h1>
        </div>
        <div className="h-1 flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`flex-1 ${i % 2 === 0 ? 'bg-gold/60' : 'bg-tk-green/60'}`}
            />
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <ProfileForm
          locale={locale}
          profile={profile}
          universities={universities}
          majors={majors}
          scholarships={scholarships}
          defaultDisplayName={defaultDisplayName}
        />
      </div>
    </>
  );
}
