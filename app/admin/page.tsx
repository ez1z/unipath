import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GulPattern } from '@/components/ui/GulPattern';
import { AdminHeader } from '@/components/admin/AdminHeader';
import type { AdminRole } from '@/lib/admin/auth';

export const metadata = { title: 'Dashboard — UniPath Admin' };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/signin');

  const { data: adminRow } = await supabase
    .from('admins')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const role = (adminRow?.role ?? 'admin') as AdminRole;

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} role={role} />

      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Signed in as {user.email}
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
              Universities
            </div>
            <p className="text-sm text-muted-foreground">View, manage, and delete university records.</p>
          </a>
          <a
            href="/admin/universities/import"
            className="bg-card rounded-xl border border-border border-t-4 border-t-gold p-6 hover:shadow-card transition-shadow group"
          >
            <div className="font-heading font-bold text-lg text-foreground mb-1 group-hover:text-primary transition-colors">
              Import CSV
            </div>
            <p className="text-sm text-muted-foreground">Bulk-upload universities from a CSV file.</p>
          </a>
          <a
            href="/admin/scholarships"
            className="bg-card rounded-xl border border-border border-t-4 border-t-tk-green p-6 hover:shadow-card transition-shadow group"
          >
            <div className="font-heading font-bold text-lg text-foreground mb-1 group-hover:text-primary transition-colors">
              Scholarships
            </div>
            <p className="text-sm text-muted-foreground">Manage scholarship listings linked to universities or countries.</p>
          </a>

          {role === 'superuser' && (
            <>
              <a
                href="/admin/admins"
                className="bg-card rounded-xl border border-border border-t-4 border-t-amber-400 p-6 hover:shadow-card transition-shadow group"
              >
                <div className="font-heading font-bold text-lg text-foreground mb-1 group-hover:text-amber-600 transition-colors">
                  Manage Admins
                </div>
                <p className="text-sm text-muted-foreground">Add admins, reset passwords, and revoke access.</p>
              </a>
              <a
                href="/admin/logs"
                className="bg-card rounded-xl border border-border border-t-4 border-t-slate-400 p-6 hover:shadow-card transition-shadow group"
              >
                <div className="font-heading font-bold text-lg text-foreground mb-1 group-hover:text-slate-600 transition-colors">
                  Audit Logs
                </div>
                <p className="text-sm text-muted-foreground">See what each admin has done and when.</p>
              </a>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
