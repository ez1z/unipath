import { getTranslations } from 'next-intl/server';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { requireAdmin } from '@/lib/admin/auth';

export const metadata = { title: 'Dashboard — UniPath Admin' };

export default async function AdminPage() {
  const { user, role } = await requireAdmin();
  const t = await getTranslations('admin');

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} role={role} />

      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-foreground">{t('dashboard_title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t('dashboard_signed_in_as')} {user.email}
            {role === 'superuser' && (
              <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                superuser
              </span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <a
            href="/admin/universities"
            className="bg-card rounded-xl border border-border border-t-4 border-t-primary p-6 hover:shadow-card transition-shadow group"
          >
            <div className="font-heading font-bold text-lg text-foreground mb-1 group-hover:text-primary transition-colors">
              {t('dashboard_unis_title')}
            </div>
            <p className="text-sm text-muted-foreground">{t('dashboard_unis_desc')}</p>
          </a>
          <a
            href="/admin/universities/import"
            className="bg-card rounded-xl border border-border border-t-4 border-t-gold p-6 hover:shadow-card transition-shadow group"
          >
            <div className="font-heading font-bold text-lg text-foreground mb-1 group-hover:text-primary transition-colors">
              {t('dashboard_import_title')}
            </div>
            <p className="text-sm text-muted-foreground">{t('dashboard_import_desc')}</p>
          </a>
          <a
            href="/admin/scholarships"
            className="bg-card rounded-xl border border-border border-t-4 border-t-tk-green p-6 hover:shadow-card transition-shadow group"
          >
            <div className="font-heading font-bold text-lg text-foreground mb-1 group-hover:text-primary transition-colors">
              {t('dashboard_scholarships_title')}
            </div>
            <p className="text-sm text-muted-foreground">{t('dashboard_scholarships_desc')}</p>
          </a>

          {role === 'superuser' && (
            <>
              <a
                href="/admin/admins"
                className="bg-card rounded-xl border border-border border-t-4 border-t-amber-400 p-6 hover:shadow-card transition-shadow group"
              >
                <div className="font-heading font-bold text-lg text-foreground mb-1 group-hover:text-amber-600 transition-colors">
                  {t('dashboard_admins_title')}
                </div>
                <p className="text-sm text-muted-foreground">{t('dashboard_admins_desc')}</p>
              </a>
              <a
                href="/admin/logs"
                className="bg-card rounded-xl border border-border border-t-4 border-t-slate-400 p-6 hover:shadow-card transition-shadow group"
              >
                <div className="font-heading font-bold text-lg text-foreground mb-1 group-hover:text-slate-600 transition-colors">
                  {t('dashboard_logs_title')}
                </div>
                <p className="text-sm text-muted-foreground">{t('dashboard_logs_desc')}</p>
              </a>
              <a
                href="/admin/system-logs"
                className="bg-card rounded-xl border border-border border-t-4 border-t-red-400 p-6 hover:shadow-card transition-shadow group"
              >
                <div className="font-heading font-bold text-lg text-foreground mb-1 group-hover:text-red-600 transition-colors">
                  {t('dashboard_system_logs_title')}
                </div>
                <p className="text-sm text-muted-foreground">{t('dashboard_system_logs_desc')}</p>
              </a>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
