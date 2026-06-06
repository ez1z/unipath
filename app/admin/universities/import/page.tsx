import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { GulPattern } from '@/components/ui/GulPattern';
import { signOutAction } from '@/app/admin/actions';
import { CsvImportClient } from '@/components/admin/CsvImportClient';
import type { UniversityDbRow } from '@/lib/data/university-types';

export const metadata = { title: 'Import Universities — UniPath Admin' };

export default async function ImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/signin');

  const { data } = await supabase
    .from('universities')
    .select('*')
    .order('name_en', { ascending: true });

  const existingData: Record<string, string>[] = (data ?? []).map((u: UniversityDbRow) => ({
    name_en: u.name_en,
    name_ru: u.name_ru,
    name_tk: u.name_tk,
    country: u.country,
    city: u.city,
    tuition_usd: String(Number(u.tuition_usd)),
    moe_approved: String(u.moe_approved),
    ranking_qs: u.ranking_qs != null ? String(u.ranking_qs) : '',
    languages: u.languages.join('|'),
    majors: u.majors.join('|'),
    official_website: u.official_website,
    application_portal_url: u.application_portal_url,
    entrance_requirements:
      u.entrance_requirements && Object.keys(u.entrance_requirements).length > 0
        ? JSON.stringify(u.entrance_requirements)
        : '',
  }));

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-primary shadow-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <GulPattern size={28} className="text-gold" />
            <Link href="/admin" className="font-heading font-bold text-xl text-gold tracking-wide">UniPath</Link>
            <span className="text-primary-foreground/40 text-sm font-medium ml-1">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-primary-foreground/60 text-sm hidden sm:block">{user.email}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Sign out of admin"
                className="rounded-md border border-primary-foreground/25 px-3.5 py-1.5 text-sm font-medium text-primary-foreground/80 hover:border-gold hover:text-gold transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="h-1 flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-gold' : 'bg-tk-green'}`} />
          ))}
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-8">
          <Link href="/admin/universities" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            ← Universities
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground mt-2">Import universities from CSV</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Download the template, fill it in, and upload to bulk-add universities.
          </p>
        </div>
        <CsvImportClient existingData={existingData} />
      </main>
    </div>
  );
}
