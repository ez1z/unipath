import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { GulPattern } from '@/components/ui/GulPattern';
import { signOutAction } from '@/app/admin/actions';
import { UniversityAdminRow } from '@/components/admin/UniversityAdminRow';
import type { UniversityDbRow } from '@/lib/data/university-types';

export const metadata = { title: 'Universities — UniPath Admin' };

export default async function AdminUniversitiesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/signin');

  const { data, error } = await supabase
    .from('universities')
    .select('id, name_en, country, moe_approved, created_at')
    .order('name_en', { ascending: true });

  if (error) throw new Error(error.message);

  type Row = Pick<UniversityDbRow, 'id' | 'name_en' | 'country' | 'moe_approved' | 'created_at'>;
  const universities = data as Row[];

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

      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              ← Dashboard
            </Link>
            <h1 className="font-heading text-2xl font-bold text-foreground mt-2">Universities</h1>
            <p className="text-muted-foreground text-sm mt-1">{universities.length} total</p>
          </div>
          <Link
            href="/admin/universities/import"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Import CSV
          </Link>
        </div>

        {universities.length === 0 ? (
          <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
            <GulPattern size={48} className="text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground text-sm mb-4">No universities yet.</p>
            <Link
              href="/admin/universities/import"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Import from CSV →
            </Link>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">University</th>
                  <th className="text-left px-4 py-3 font-medium">Country</th>
                  <th className="text-left px-4 py-3 font-medium">MoE Approved</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
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
