'use client';

import { usePathname, useRouter } from 'next/navigation';
import { SUPPORTED_LOCALES } from '@/lib/constants';
import type { Locale } from '@/lib/constants';

const LABELS: Record<Locale, string> = { tk: 'TK', ru: 'RU', en: 'EN' };

type Props = { currentLocale: Locale };

export function LocaleSwitcher({ currentLocale }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(next: Locale) {
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
    const segments = pathname.split('/');
    segments[1] = next;
    router.push(segments.join('/'));
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Language selector">
      {SUPPORTED_LOCALES.map((loc) => (
        <button
          key={loc}
          onClick={() => switchLocale(loc)}
          disabled={loc === currentLocale}
          aria-pressed={loc === currentLocale}
          className={`px-2.5 py-1 rounded text-xs font-semibold tracking-wider transition-colors ${
            loc === currentLocale
              ? 'bg-gold text-white cursor-default'
              : 'text-primary-foreground/60 hover:text-gold hover:bg-white/10'
          }`}
        >
          {LABELS[loc]}
        </button>
      ))}
    </div>
  );
}
