import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { ScholarshipForm } from '@/components/admin/ScholarshipForm';
import type { ScholarshipFormDefaults } from '@/components/admin/ScholarshipForm';
import { updateScholarshipAction } from '@/app/admin/scholarships/actions';
import { requireAdmin } from '@/lib/admin/auth';
import type { ScholarshipDbRow } from '@/lib/data/scholarship-types';
import type { UniversityDbRow } from '@/lib/data/university-types';

export const metadata = { title: 'Edit Scholarship — UniPath Admin' };

type Props = { params: { id: string } };

export default async function EditScholarshipPage({ params: { id } }: Props) {
  const { supabase, user } = await requireAdmin();

  const [{ data: scholarshipData }, { data: universitiesData, error: uniError }] = await Promise.all([
    supabase.from('scholarships').select('*').eq('id', id).maybeSingle(),
    supabase.from('universities').select('id, name_en, country').order('name_en', { ascending: true }),
  ]);

  if (!scholarshipData) notFound();
  if (uniError) throw new Error(uniError.message);

  const s = scholarshipData as ScholarshipDbRow;
  type UniversityOption = Pick<UniversityDbRow, 'id' | 'name_en' | 'country'>;
  const universities = universitiesData as UniversityOption[];

  const { parseSemestersJson } = await import('@/lib/types/semester');

  const defaultValues: ScholarshipFormDefaults = {
    name_en: s.name_en,
    name_ru: s.name_ru,
    name_tk: s.name_tk,
    country: s.country,
    university_id: s.university_id,
    type: s.type,
    coverage: s.coverage,
    amount_usd: s.amount_usd != null ? String(Number(s.amount_usd)) : '',
    deadline_text: s.deadline_text ?? '',
    semesters: parseSemestersJson(s.semesters),
    description_en: s.description_en,
    description_ru: s.description_ru,
    description_tk: s.description_tk,
    application_url: s.application_url,
  };

  const boundAction = updateScholarshipAction.bind(null, id);

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} />

      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
        <div className="mb-8">
          <Link href="/admin/scholarships" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            ← Scholarships
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground mt-2">Edit scholarship</h1>
          <p className="text-muted-foreground text-sm mt-1 text-gold-dark font-medium">{s.name_en}</p>
        </div>
        <ScholarshipForm
          universities={universities}
          defaultValues={defaultValues}
          action={boundAction}
          submitLabel="Save changes"
          cancelHref="/admin/scholarships"
        />
      </main>
    </div>
  );
}
