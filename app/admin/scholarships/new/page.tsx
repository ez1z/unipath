import Link from 'next/link';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { ScholarshipForm } from '@/components/admin/ScholarshipForm';
import { createScholarshipAction } from '@/app/admin/scholarships/actions';
import { requireAdmin } from '@/lib/admin/auth';
import type { UniversityDbRow } from '@/lib/data/university-types';

export const metadata = { title: 'Add Scholarship — UniPath Admin' };

export default async function NewScholarshipPage() {
  const { supabase, user } = await requireAdmin();

  const { data: universitiesData, error } = await supabase
    .from('universities')
    .select('id, name_en, country')
    .order('name_en', { ascending: true });

  if (error) throw new Error(error.message);

  type UniversityOption = Pick<UniversityDbRow, 'id' | 'name_en' | 'country'>;
  const universities = universitiesData as UniversityOption[];

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} />

      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
        <div className="mb-8">
          <Link href="/admin/scholarships" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            {"← Scholarships"}
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground mt-2">{"Add scholarship"}</h1>
          <p className="text-muted-foreground text-sm mt-1">{"Fill in the details below. All fields marked * are required."}</p>
        </div>
        <ScholarshipForm
          universities={universities}
          action={createScholarshipAction}
          submitLabel={"Add scholarship"}
          cancelHref="/admin/scholarships"
        />
      </main>
    </div>
  );
}
