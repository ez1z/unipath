import Link from 'next/link';
import { requireSuperuser } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AddAdminForm } from '@/components/admin/AddAdminForm';

export const metadata = { title: 'Add Admin — UniPath Admin' };

export default async function AddAdminPage() {
  const { user } = await requireSuperuser();

  return (
    <div className="min-h-screen flex flex-col">
      <AdminHeader email={user.email!} role="superuser" />

      <main className="flex-1 container mx-auto px-4 py-10 max-w-lg">
        <Link href="/admin/admins" className="text-sm text-muted-foreground hover:text-primary transition-colors">
          {"← Back to Admins"}
        </Link>
        <h1 className="font-heading text-2xl font-bold text-foreground mt-4 mb-6">{"Add Admin"}</h1>

        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <p className="text-sm text-muted-foreground mb-5">
            {"Create a new admin account or grant access to an existing Supabase user. Admins can manage universities and scholarships."}
          </p>
          <AddAdminForm />
        </div>
      </main>
    </div>
  );
}
