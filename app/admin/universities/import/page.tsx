import Link from 'next/link';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { CsvImportClient } from '@/components/admin/CsvImportClient';
import { requireAdmin } from '@/lib/admin/auth';
import type { UniversityDbRow } from '@/lib/data/university-types';

export const metadata = { title: 'Import Universities — UniPath Admin' };

export default async function ImportPage() {
  const { supabase, user } = await requireAdmin();

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
      <AdminHeader email={user.email!} />

      <main className="flex-1 container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-8">
          <Link href="/admin/universities" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            ← Universities
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground mt-2">Import universities from CSV</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Download the current data, edit it, and re-upload to apply changes in bulk.
          </p>
        </div>
        <CsvImportClient existingData={existingData} />
      </main>
    </div>
  );
}
