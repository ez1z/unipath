import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { ScholarshipCsvImportClient } from '@/components/admin/ScholarshipCsvImportClient';
import { requireAdmin } from '@/lib/admin/auth';
import type { ScholarshipDbRow } from '@/lib/data/scholarship-types';

export const metadata = { title: 'Import Scholarships — UniPath Admin' };

export default async function ImportScholarshipsPage() {
  const { supabase, user } = await requireAdmin();

  const { data } = await supabase
    .from('scholarships')
    .select('*')
    .order('country', { ascending: true })
    .order('name_en', { ascending: true });

  const existingData: Record<string, string>[] = (data ?? []).map(
    (s: ScholarshipDbRow) => ({
      name_en: s.name_en,
      name_ru: s.name_ru,
      name_tk: s.name_tk,
      country: s.country,
      university_name_en: '',
      type: s.type,
      coverage: (s.coverage ?? []).join('|'),
      amount_usd: s.amount_usd != null ? String(Number(s.amount_usd)) : '',
      deadline_text: s.deadline_text ?? '',
      description_en: s.description_en,
      description_ru: s.description_ru,
      description_tk: s.description_tk,
      application_url: s.application_url,
    }),
  );

  const t = await getTranslations('admin');

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} />

      <main className="flex-1 container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-8">
          <Link
            href="/admin/scholarships"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {t('back_scholarships')}
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground mt-2">
            {t('scholarships_import_title')}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t('scholarships_import_subtitle')}</p>
        </div>
        <ScholarshipCsvImportClient existingData={existingData} />
      </main>
    </div>
  );
}
