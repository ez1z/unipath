import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { UniversityForm } from '@/components/admin/UniversityForm';
import type { UniversityFormDefaults } from '@/components/admin/UniversityForm';
import { updateUniversityAction } from '@/app/admin/universities/actions';
import type { UniversityDbRow } from '@/lib/data/university-types';

export const metadata = { title: 'Edit University — UniPath Admin' };

type Props = { params: { id: string } };

export default async function EditUniversityPage({ params: { id } }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/signin');

  const { data } = await supabase
    .from('universities')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!data) notFound();
  const u = data as UniversityDbRow;

  const defaultValues: UniversityFormDefaults = {
    name_en: u.name_en,
    name_ru: u.name_ru,
    name_tk: u.name_tk,
    country: u.country,
    city: u.city,
    tuition_usd: String(Number(u.tuition_usd)),
    moe_approved: u.moe_approved,
    ranking_qs: u.ranking_qs != null ? String(u.ranking_qs) : '',
    languages: u.languages.join('|'),
    majors: u.majors.join('|'),
    official_website: u.official_website,
    application_portal_url: u.application_portal_url,
    entrance_requirements:
      u.entrance_requirements && Object.keys(u.entrance_requirements).length > 0
        ? JSON.stringify(u.entrance_requirements, null, 2)
        : '',
  };

  const boundAction = updateUniversityAction.bind(null, id);

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} />

      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
        <div className="mb-8">
          <Link href="/admin/universities" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            ← Universities
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground mt-2">Edit university</h1>
          <p className="text-muted-foreground text-sm mt-1 text-gold-dark font-medium">{u.name_en}</p>
        </div>
        <UniversityForm
          defaultValues={defaultValues}
          action={boundAction}
          submitLabel="Save changes"
          cancelHref="/admin/universities"
        />
      </main>
    </div>
  );
}
