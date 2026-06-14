import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSuperuser } from '@/lib/admin/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { ResetPasswordForm } from '@/components/admin/ResetPasswordForm';

export const metadata = { title: 'Reset Password — UniPath Admin' };

type Props = { params: { id: string } };

export default async function AdminDetailPage({ params: { id } }: Props) {
  const { user } = await requireSuperuser();
  const service = createServiceClient();

  const [{ data: adminRow }, { data: targetUserData }] = await Promise.all([
    service.from('admins').select('user_id, role').eq('user_id', id).single(),
    service.auth.admin.getUserById(id),
  ]);

  if (!adminRow) notFound();

  const targetEmail = targetUserData?.user?.email ?? '(unknown)';
  const isSelf = id === user.id;

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} role="superuser" />

      <main className="flex-1 container mx-auto px-4 py-10 max-w-lg">
        <Link href="/admin/admins" className="text-sm text-muted-foreground hover:text-primary transition-colors">
          {"← Back to Admins"}
        </Link>
        <h1 className="font-heading text-2xl font-bold text-foreground mt-4 mb-1">{"Reset Password"}</h1>
        <p className="text-muted-foreground text-sm mb-6">{targetEmail}</p>

        {isSelf ? (
          <div className="bg-card rounded-xl border border-border shadow-card p-6 text-sm text-muted-foreground">
            {"You cannot reset your own password from here. Use the sign-in flow to reset it."}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border shadow-card p-6">
            <ResetPasswordForm targetUserId={id} />
          </div>
        )}
      </main>
    </div>
  );
}
