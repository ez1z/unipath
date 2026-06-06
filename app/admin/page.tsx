import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GulPattern } from '@/components/ui/GulPattern';
import { signOutAction } from './actions';

export const metadata = { title: 'Dashboard — UniPath Admin' };

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/signin');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header — same crimson style as NavBar/page headers */}
      <header className="bg-primary shadow-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <GulPattern size={28} className="text-gold" />
            <span className="font-heading font-bold text-xl text-gold tracking-wide">UniPath</span>
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

        {/* Carpet stripe */}
        <div className="h-1 flex">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`flex-1 ${i % 2 === 0 ? 'bg-gold' : 'bg-tk-green'}`} />
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Signed in as {user.email}</p>
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
        </div>
      </main>
    </div>
  );
}
