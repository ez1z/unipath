'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/lib/constants';
import { LinkUniversityDialog } from './LinkUniversityDialog';

export type MoeEntry = {
  name: string;
  country: string;
  slug?: string;
};

export type DbUniversity = {
  id: string;
  name_en: string;
};

type Props = {
  entries: MoeEntry[];
  locale: Locale;
  isAdmin?: boolean;
  allDbUniversities?: DbUniversity[];
};

export function MoeUniversityList({ entries, locale, isAdmin, allDbUniversities = [] }: Props) {
  const t = useTranslations('moe_approved_page');
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [dialogEntry, setDialogEntry] = useState<MoeEntry | null>(null);

  const listedCount = entries.filter((e) => e.slug).length;

  const filtered = search.trim()
    ? entries.filter((e) => {
        const q = search.toLowerCase();
        return e.name.toLowerCase().includes(q) || e.country.toLowerCase().includes(q);
      })
    : entries;

  function handleSuccess() {
    setDialogEntry(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Stats + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-sm text-muted-foreground shrink-0">
          {t('count', { found: listedCount, total: entries.length })}
        </p>
        <div className="relative flex-1 sm:max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_placeholder')}
            aria-label={t('search_placeholder')}
            className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {search && (
          <p className="text-sm text-muted-foreground shrink-0">
            {t('results', { count: filtered.length })}
          </p>
        )}
      </div>

      {/* List */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((entry, i) =>
          entry.slug ? (
            <li key={i}>
              <Link
                href={`/${locale}/universities/${entry.slug}`}
                className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3.5 hover:border-gold hover:bg-gold/5 transition-colors group"
              >
                <span className="text-sm font-medium text-foreground group-hover:text-gold transition-colors line-clamp-2">
                  {entry.name}
                </span>
                {entry.country && (
                  <span className="text-xs text-muted-foreground">{entry.country}</span>
                )}
                <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-gold">
                  <span aria-hidden="true">★</span>
                  {"MoE Approved"}
                </span>
              </Link>
            </li>
          ) : (
            <li key={i}>
              <div
                className="relative flex flex-col gap-1 rounded-xl border border-border bg-card/50 px-4 py-3.5 opacity-60 cursor-default"
                aria-label={`${entry.name} — ${t('not_listed')}`}
              >
                <span className="text-sm font-medium text-foreground line-clamp-2">
                  {entry.name}
                </span>
                {entry.country && (
                  <span className="text-xs text-muted-foreground">{entry.country}</span>
                )}
                <span className="mt-1 text-xs text-muted-foreground">{t('not_listed')}</span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setDialogEntry(entry)}
                    aria-label={`Link ${entry.name} to UniPath`}
                    className="absolute top-2.5 right-2.5 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors opacity-100"
                    title="Link to UniPath university"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                )}
              </div>
            </li>
          )
        )}
      </ul>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-12 text-sm">
          {"No universities match your search."}
        </p>
      )}

      {dialogEntry && (
        <LinkUniversityDialog
          moeEntryName={dialogEntry.name}
          allDbUniversities={allDbUniversities}
          onClose={() => setDialogEntry(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
