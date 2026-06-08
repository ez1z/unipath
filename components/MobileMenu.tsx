'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/lib/constants';

type Props = { locale: Locale };

export function MobileMenu({ locale }: Props) {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle navigation menu"
        aria-expanded={open}
        className="p-2 text-primary-foreground/80 hover:text-gold transition-colors"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-primary border border-white/10 rounded-xl shadow-card-hover z-50 overflow-hidden">
          <Link
            href={`/${locale}/universities`}
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm text-primary-foreground/80 hover:text-gold hover:bg-white/5 transition-colors"
          >
            {t('universities')}
          </Link>
          <Link
            href={`/${locale}/compare`}
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm text-primary-foreground/80 hover:text-gold hover:bg-white/5 transition-colors border-t border-white/5"
          >
            {t('compare')}
          </Link>
          <Link
            href={`/${locale}/transfer`}
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm text-primary-foreground/80 hover:text-gold hover:bg-white/5 transition-colors border-t border-white/5"
          >
            {t('transfer')}
          </Link>
          <Link
            href={`/${locale}/scholarships`}
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm text-primary-foreground/80 hover:text-gold hover:bg-white/5 transition-colors border-t border-white/5"
          >
            {t('scholarships')}
          </Link>
        </div>
      )}
    </div>
  );
}
