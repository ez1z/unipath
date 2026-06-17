import Link from 'next/link';
import { GulPattern } from '@/components/ui/GulPattern';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { ScholarshipAdminTable } from '@/components/admin/ScholarshipAdminTable';
import { requireAdmin } from '@/lib/admin/auth';
import type { ScholarshipDbRow } from '@/lib/data/scholarship-types';

export const metadata = { title: 'Scholarships — UniPath Admin' };

export default async function AdminScholarshipsPage() {
  const { supabase, user, role } = await requireAdmin();

  const { data, error } = await supabase
    .from('scholarships')
    .select('id, name_en, country, type, created_at')
    .order('country', { ascending: true })
    .order('name_en', { ascending: true });

  if (error) throw new Error(error.message);

  type Row = Pick<ScholarshipDbRow, 'id' | 'name_en' | 'country' | 'type' | 'created_at'>;
  const scholarships = data as Row[];

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} role={role} />

      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              {"← Dashboard"}
            </Link>
            <h1 className="font-heading text-2xl font-bold text-foreground mt-2">{"Scholarships"}</h1>
            <p className="text-muted-foreground text-sm mt-1">{`${scholarships.length} total`}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href="/admin/scholarships/import"
              className="px-4 py-2 border border-primary text-primary rounded-lg text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {"Import CSV"}
            </Link>
            <Link
              href="/admin/scholarships/new"
              className="px-4 py-2 bg-gold text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {"+ Add scholarship"}
            </Link>
          </div>
        </div>

        {scholarships.length === 0 ? (
          <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
            <GulPattern size={48} className="text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground text-sm mb-4">{"No scholarships yet."}</p>
            <Link href="/admin/scholarships/new" className="text-sm font-semibold text-gold hover:underline">
              {"Add one →"}
            </Link>
          </div>
        ) : (
          <ScholarshipAdminTable scholarships={scholarships} />
        )}
      </main>
    </div>
  );
}
