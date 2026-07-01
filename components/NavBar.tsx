import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { MobileMenu } from '@/components/MobileMenu';
import { NavBarAuthButtons } from '@/components/NavBarAuthButtons';
import type { User } from '@supabase/supabase-js';

type Props = { locale: Locale };

export async function NavBar({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'nav' });

  let user: User | null = null;
  let isAdmin = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
    if (user) {
      const { data: adminRow } = await supabase
        .from('admins')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      isAdmin = !!adminRow;
    }
  } catch {
    // Supabase unreachable — render unauthenticated state
  }

  return (
    <nav
      className="bg-brand-dark border-b border-white/10 sticky top-0 z-40"
      aria-label={t('main_nav_label')}
    >
      <div className="container mx-auto px-5 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            href={`/${locale}`}
            className="font-heading font-bold text-xl tracking-wide text-gold hover:text-gold/80 transition-colors"
            aria-label={t('home_link_label')}
          >
            UniPath
          </Link>
          <div className="hidden sm:flex items-center gap-0.5 text-sm font-medium">
            <Link href={`/${locale}/universities`} className="px-3 py-2 rounded-md text-white/55 hover:text-gold hover:bg-white/5 transition-colors">
              {t('universities')}
            </Link>
            <Link href={`/${locale}/compare`} className="px-3 py-2 rounded-md text-white/55 hover:text-gold hover:bg-white/5 transition-colors">
              {t('compare')}
            </Link>
            <Link href={`/${locale}/transfer`} className="px-3 py-2 rounded-md text-white/55 hover:text-gold hover:bg-white/5 transition-colors">
              {t('transfer')}
            </Link>
            <Link href={`/${locale}/scholarships`} className="px-3 py-2 rounded-md text-white/55 hover:text-gold hover:bg-white/5 transition-colors">
              {t('scholarships')}
            </Link>
            <Link href={`/${locale}/discussions`} className="px-3 py-2 rounded-md text-white/55 hover:text-gold hover:bg-white/5 transition-colors">
              {t('discussions')}
            </Link>
            <Link href={`/${locale}/moe-approved`} className="px-3 py-2 rounded-md text-white/55 hover:text-gold hover:bg-white/5 transition-colors">
              {t('moe_approved')}
            </Link>
            <Link href={`/${locale}/support`} className="px-3 py-2 rounded-md text-white/55 hover:text-gold hover:bg-white/5 transition-colors">
              {t('support')}
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <MobileMenu locale={locale} user={user} isAdmin={isAdmin} />
          <LocaleSwitcher currentLocale={locale} />
          <NavBarAuthButtons locale={locale} user={user} isAdmin={isAdmin} />
        </div>
      </div>
    </nav>
  );
}
