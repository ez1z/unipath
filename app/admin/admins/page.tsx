import Link from 'next/link';
import { requireSuperuser } from '@/lib/admin/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminAdminRow } from '@/components/admin/AdminAdminRow';

export const metadata = { title: 'Manage Admins — UniPath Admin' };

export default async function AdminsPage() {
  const { user } = await requireSuperuser();
  const service = createServiceClient();

  const [{ data: adminRows }, { data: listData }] = await Promise.all([
    service.from('admins').select('user_id, role'),
    service.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const userMap = new Map((listData?.users ?? []).map((u) => [u.id, u]));

  const admins = (adminRows ?? [])
    .map((row) => ({
      userId: row.user_id,
      role: row.role as 'admin' | 'superuser',
      email: userMap.get(row.user_id)?.email ?? '(unknown)',
      createdAt: userMap.get(row.user_id)?.created_at,
    }))
    .sort((a, b) => {
      if (a.role === 'superuser') return -1;
      if (b.role === 'superuser') return 1;
      return a.email.localeCompare(b.email);
    });

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} role="superuser" />

      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              ← Dashboard
            </Link>
            <h1 className="font-heading text-2xl font-bold text-foreground mt-2">Manage Admins</h1>
            <p className="text-muted-foreground text-sm mt-1">{admins.length} total</p>
          </div>
          <Link
            href="/admin/admins/new"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            + Add Admin
          </Link>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <AdminAdminRow
                  key={admin.userId}
                  admin={admin}
                  isSelf={admin.userId === user.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
