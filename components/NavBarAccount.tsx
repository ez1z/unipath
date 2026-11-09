'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { MobileMenu } from '@/components/MobileMenu';
import { NavBarAuthButtons } from '@/components/NavBarAuthButtons';
import { createClient } from '@/lib/supabase/client';
import type { Locale } from '@/lib/constants';

type Props = { locale: Locale; children?: React.ReactNode };

/**
 * The signed-in part of the nav bar (account menu, mobile menu), read in the
 * browser.
 *
 * The nav bar sits in the locale layout, so reading the session on the server
 * made every page render per request and none could be cached. The session is
 * re-read on each navigation, which covers sign-in and sign-out: both are
 * server actions that redirect to another page.
 */
export function NavBarAccount({ locale, children }: Props) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const sessionUser = data.session?.user ?? null;
        let admin = false;
        if (sessionUser) {
          const { data: adminRow } = await supabase
            .from('admins')
            .select('role')
            .eq('user_id', sessionUser.id)
            .maybeSingle();
          admin = !!adminRow;
        }
        if (!alive) return;
        setUser(sessionUser);
        setIsAdmin(admin);
      })
      .catch(() => {
        // Supabase unreachable: keep the signed-out state.
      });
    return () => {
      alive = false;
    };
  }, [pathname]);

  return (
    <>
      <MobileMenu locale={locale} user={user} isAdmin={isAdmin} />
      {children}
      <NavBarAuthButtons locale={locale} user={user} isAdmin={isAdmin} />
    </>
  );
}
