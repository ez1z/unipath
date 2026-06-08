import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { GulPattern } from '@/components/ui/GulPattern';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { ScholarshipAdminRow } from '@/components/admin/ScholarshipAdminRow';
import type { ScholarshipDbRow } from '@/lib/data/scholarship-types';

export const metadata = { title: 'Scholarships — UniPath Admin' };

export default async function AdminScholarshipsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/signin');

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
      <AdminHeader email={user.email!} />

      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              ← Dashboard
            </Link>
            <h1 className="font-heading text-2xl font-bold text-foreground mt-2">Scholarships</h1>
            <p className="text-muted-foreground text-sm mt-1">{scholarships.length} total</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/scholarships/import"
              className="px-4 py-2 border border-primary text-primary rounded-lg text-sm font-semibold hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              Import CSV
            </Link>
            <Link
              href="/admin/scholarships/new"
              className="px-4 py-2 bg-gold text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              + Add scholarship
            </Link>
          </div>
        </div>

        {scholarships.length === 0 ? (
          <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
            <GulPattern size={48} className="text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground text-sm mb-4">No scholarships yet.</p>
            <Link href="/admin/scholarships/new" className="text-sm font-semibold text-gold hover:underline">
              Add one →
            </Link>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Scholarship</th>
                  <th className="text-left px-4 py-3 font-medium">Country</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {scholarships.map((s) => (
                  <ScholarshipAdminRow key={s.id} scholarship={s} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
