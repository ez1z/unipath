import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { signOutAction } from '@/app/admin/actions';

type Props = { email: string; role?: 'admin' | 'superuser' };

export async function AdminHeader({ email, role }: Props) {
  const t = await getTranslations('admin');
  return (
    <header className="bg-brand-dark border-b border-white/10">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="font-heading font-bold text-xl text-gold tracking-wide hover:text-gold/80 transition-colors">
            UniPath
          </Link>
          <span className="text-white/25 text-sm font-medium">Admin</span>
        </div>
        <div className="flex items-center gap-4">
          {role === 'superuser' && (
            <nav className="hidden sm:flex items-center gap-1" aria-label="Superuser navigation">
              <Link
                href="/admin/admins"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-white/55 hover:text-gold hover:bg-white/5 transition-colors"
              >
                {t('header_admins')}
              </Link>
              <Link
                href="/admin/logs"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-white/55 hover:text-gold hover:bg-white/5 transition-colors"
              >
                {t('header_logs')}
              </Link>
            </nav>
          )}
          <span className="text-white/30 text-sm hidden sm:block">{email}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Sign out of admin"
              className="rounded-md border border-white/15 px-3.5 py-1.5 text-sm font-medium text-white/55 hover:border-gold/50 hover:text-gold transition-colors"
            >
              {t('header_sign_out')}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
