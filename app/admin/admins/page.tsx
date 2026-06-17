import Link from 'next/link';
import { requireSuperuser } from '@/lib/admin/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminUserRow } from '@/components/admin/AdminUserRow';

export const metadata = { title: 'Users & Roles — UniPath Admin' };

export default async function AdminsPage() {
  const { user } = await requireSuperuser();
  const service = createServiceClient();

  const [{ data: adminRows }, { data: listData }] = await Promise.all([
    service.from('admins').select('user_id, role'),
    service.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const roleMap = new Map((adminRows ?? []).map((r) => [r.user_id, r.role as 'admin' | 'superuser']));

  const allUsers = (listData?.users ?? [])
    .map((u) => ({
      userId: u.id,
      email: u.email ?? '(no email)',
      role: roleMap.get(u.id) ?? 'none' as 'admin' | 'superuser' | 'none',
      createdAt: u.created_at,
    }))
    .sort((a, b) => {
      const order = { superuser: 0, admin: 1, none: 2 };
      const diff = order[a.role] - order[b.role];
      if (diff !== 0) return diff;
      return a.email.localeCompare(b.email);
    });

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} role="superuser" />

      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="flex flex-col gap-4 mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              {"← Dashboard"}
            </Link>
            <h1 className="font-heading text-2xl font-bold text-foreground mt-2">{"Users & Roles"}</h1>
            <p className="text-muted-foreground text-sm mt-1">{`${allUsers.length} total`}</p>
          </div>
          <Link
            href="/admin/admins/new"
            className="self-start sm:self-auto px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {"+ Add Admin"}
          </Link>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          {allUsers.map((u) => (
            <AdminUserRow
              key={u.userId}
              user={u}
              isSelf={u.userId === user.id}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
