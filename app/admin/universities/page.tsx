import Link from 'next/link';
import { GulPattern } from '@/components/ui/GulPattern';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { UniversityAdminRow } from '@/components/admin/UniversityAdminRow';
import { requireAdmin } from '@/lib/admin/auth';
import type { UniversityDbRow } from '@/lib/data/university-types';

export const metadata = { title: 'Universities — UniPath Admin' };

export default async function AdminUniversitiesPage() {
  const { supabase, user } = await requireAdmin();

  const { data, error } = await supabase
    .from('universities')
    .select('id, name_en, country, moe_approved, created_at')
    .order('name_en', { ascending: true });

  if (error) throw new Error(error.message);

  type Row = Pick<UniversityDbRow, 'id' | 'name_en' | 'country' | 'moe_approved' | 'created_at'>;
  const universities = data as Row[];

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} />

      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              {"← Dashboard"}
            </Link>
            <h1 className="font-heading text-2xl font-bold text-foreground mt-2">{"Universities"}</h1>
            <p className="text-muted-foreground text-sm mt-1">{`${universities.length} total`}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/universities/new"
              className="px-4 py-2 bg-gold text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {"+ Add university"}
            </Link>
            <Link
              href="/admin/universities/import"
              className="px-4 py-2 border border-border text-foreground rounded-lg text-sm font-semibold hover:bg-muted transition-colors"
            >
              {"Import CSV"}
            </Link>
          </div>
        </div>

        {universities.length === 0 ? (
          <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
            <GulPattern size={48} className="text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground text-sm mb-4">{"No universities yet."}</p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/admin/universities/new" className="text-sm font-semibold text-gold hover:underline">
                {"Add one manually →"}
              </Link>
              <span className="text-muted-foreground text-sm">{"or"}</span>
              <Link href="/admin/universities/import" className="text-sm font-semibold text-primary hover:underline">
                {"Import from CSV →"}
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">{"University"}</th>
                  <th className="text-left px-4 py-3 font-medium">{"Country"}</th>
                  <th className="text-left px-4 py-3 font-medium">{"MoE Approved"}</th>
                  <th className="text-left px-4 py-3 font-medium">{"Created"}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {universities.map((u) => (
                  <UniversityAdminRow key={u.id} university={u} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
