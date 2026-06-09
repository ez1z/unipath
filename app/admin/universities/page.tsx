import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { GulPattern } from '@/components/ui/GulPattern';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { UniversityAdminRow } from '@/components/admin/UniversityAdminRow';
import { requireAdmin } from '@/lib/admin/auth';
import type { UniversityDbRow } from '@/lib/data/university-types';

export const metadata = { title: 'Universities — UniPath Admin' };

export default async function AdminUniversitiesPage() {
  const { supabase, user } = await requireAdmin();
  const t = await getTranslations('admin');

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
              {t('back_dashboard')}
            </Link>
            <h1 className="font-heading text-2xl font-bold text-foreground mt-2">{t('unis_title')}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('total_count', { count: universities.length })}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/universities/new"
              className="px-4 py-2 bg-gold text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {t('unis_add')}
            </Link>
            <Link
              href="/admin/universities/import"
              className="px-4 py-2 border border-border text-foreground rounded-lg text-sm font-semibold hover:bg-muted transition-colors"
            >
              {t('unis_import')}
            </Link>
          </div>
        </div>

        {universities.length === 0 ? (
          <div className="bg-card rounded-xl border border-border shadow-card p-12 text-center">
            <GulPattern size={48} className="text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-muted-foreground text-sm mb-4">{t('unis_empty')}</p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/admin/universities/new" className="text-sm font-semibold text-gold hover:underline">
                {t('unis_add_manually')}
              </Link>
              <span className="text-muted-foreground text-sm">{t('or')}</span>
              <Link href="/admin/universities/import" className="text-sm font-semibold text-primary hover:underline">
                {t('unis_import_csv')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">{t('unis_col_name')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('unis_col_country')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('unis_col_moe')}</th>
                  <th className="text-left px-4 py-3 font-medium">{t('unis_col_created')}</th>
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
