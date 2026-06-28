import Link from 'next/link';
import { signOutAction } from '@/app/admin/actions';

type Props = { email: string; role?: 'admin' | 'superuser' };

export async function AdminHeader({ email, role }: Props) {
  return (
    <header className="bg-brand-dark border-b border-white/10">
      <div className="container mx-auto px-4">
        {/* Single row on desktop; logo+actions on top, nav below on mobile */}
        <div className="flex flex-wrap items-center py-2 gap-x-3 gap-y-1 sm:flex-nowrap sm:h-16 sm:py-0">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/admin" className="font-heading font-bold text-xl text-gold tracking-wide hover:text-gold/80 transition-colors">
              UniPath
            </Link>
            <span className="text-white/25 text-sm font-medium">Admin</span>
          </div>

          {/* Nav — full-width scrollable second row on mobile, fills middle on desktop */}
          <nav
            className="w-full order-last sm:order-none sm:w-auto sm:flex-1 sm:mx-2 flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-0.5 sm:pb-0"
            aria-label="Admin navigation"
          >
            <Link href="/admin/universities" className="rounded-md px-3 py-1.5 text-sm font-medium text-white/55 hover:text-gold hover:bg-white/5 transition-colors whitespace-nowrap">
              {"Universities"}
            </Link>
            <Link href="/admin/scholarships" className="rounded-md px-3 py-1.5 text-sm font-medium text-white/55 hover:text-gold hover:bg-white/5 transition-colors whitespace-nowrap">
              {"Scholarships"}
            </Link>
            {role === 'superuser' && (
              <>
                <Link href="/admin/analytics" className="rounded-md px-3 py-1.5 text-sm font-medium text-white/55 hover:text-gold hover:bg-white/5 transition-colors whitespace-nowrap">
                  {"Analytics"}
                </Link>
                <Link href="/admin/admins" className="rounded-md px-3 py-1.5 text-sm font-medium text-white/55 hover:text-gold hover:bg-white/5 transition-colors whitespace-nowrap">
                  {"Admins"}
                </Link>
                <Link href="/admin/logs" className="rounded-md px-3 py-1.5 text-sm font-medium text-white/55 hover:text-gold hover:bg-white/5 transition-colors whitespace-nowrap">
                  {"Logs"}
                </Link>
                <Link href="/admin/system-logs" className="rounded-md px-3 py-1.5 text-sm font-medium text-white/55 hover:text-gold hover:bg-white/5 transition-colors whitespace-nowrap">
                  {"System Logs"}
                </Link>
              </>
            )}
          </nav>

          {/* Actions — float right on mobile top row, far right on desktop */}
          <div className="ml-auto flex items-center gap-2 sm:gap-4 shrink-0">
            <span className="hidden sm:block text-white/30 text-sm truncate max-w-[180px]">{email}</span>
            <Link href="/" className="rounded-md px-2.5 py-1.5 text-sm font-medium text-white/55 hover:text-gold hover:bg-white/5 transition-colors whitespace-nowrap">
              {"View Site"}
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                aria-label="Sign out of admin"
                className="rounded-md border border-white/15 px-3 py-1.5 text-sm font-medium text-white/55 hover:border-gold/50 hover:text-gold transition-colors whitespace-nowrap"
              >
                {"Sign out"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
