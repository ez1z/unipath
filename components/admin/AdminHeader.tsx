import Link from 'next/link';
import { GulPattern } from '@/components/ui/GulPattern';
import { signOutAction } from '@/app/admin/actions';

type Props = { email: string; role?: 'admin' | 'superuser' };

export function AdminHeader({ email, role }: Props) {
  return (
    <header className="bg-primary shadow-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <GulPattern size={28} className="text-gold" />
          <Link href="/admin" className="font-heading font-bold text-xl text-gold tracking-wide">
            UniPath
          </Link>
          <span className="text-primary-foreground/40 text-sm font-medium ml-1">Admin</span>
        </div>
        <div className="flex items-center gap-4">
          {role === 'superuser' && (
            <nav className="hidden sm:flex items-center gap-1" aria-label="Superuser navigation">
              <Link
                href="/admin/admins"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-primary-foreground/70 hover:text-gold hover:bg-white/5 transition-colors"
              >
                Admins
              </Link>
              <Link
                href="/admin/logs"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-primary-foreground/70 hover:text-gold hover:bg-white/5 transition-colors"
              >
                Logs
              </Link>
            </nav>
          )}
          <span className="text-primary-foreground/60 text-sm hidden sm:block">{email}</span>
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
  );
}
