'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BACK_LINK_CLASS } from './back-link';

/**
 * Back link that restores the list filters the visitor came from (the `from`
 * query param a list card adds). Read on the client so the page itself can
 * stay cached; wrap it in <Suspense> with a plain link as the fallback.
 */
export function FilterAwareBackLink({ href, label }: { href: string; label?: string }) {
  const from = useSearchParams().get('from');
  return (
    <Link href={from ? `${href}?${from}` : href} className={BACK_LINK_CLASS}>
      ← {label}
    </Link>
  );
}
