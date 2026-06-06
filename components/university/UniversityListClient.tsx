'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { University } from '@/lib/data/universities';
import { filterUniversities } from '@/lib/data/filter-universities';
import { UniversityCard } from './UniversityCard';
import { Select } from '@/components/ui/Select';
import type { Locale } from '@/lib/constants';

type Props = {
  universities: University[];
  locale: Locale;
  countries: string[];
  languages: string[];
  majors: string[];
};

export function UniversityListClient({ universities, locale, countries, languages, majors }: Props) {
  const t = useTranslations('universities');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('');
  const [major, setMajor] = useState('');
  const [moeOnly, setMoeOnly] = useState(false);

  const filtered = useMemo(
    () =>
      filterUniversities(universities, {
        query: query || undefined,
        country: country || undefined,
        language: language || undefined,
        major: major || undefined,
        moeOnly,
      }),
    [universities, query, country, language, major, moeOnly]
  );

  function clearFilters() {
    setQuery('');
    setCountry('');
    setLanguage('');
    setMajor('');
    setMoeOnly(false);
  }

  const hasFilters = query || country || language || major || moeOnly;

  const countryOptions = [
    { value: '', label: t('filter_all_countries'), muted: true },
    ...countries.map((c) => ({ value: c, label: c })),
  ];
  const languageOptions = [
    { value: '', label: t('filter_all_languages'), muted: true },
    ...languages.map((l) => ({ value: l, label: l.toUpperCase() })),
  ];
  const majorOptions = [
    { value: '', label: t('filter_all_majors'), muted: true },
    ...majors.map((m) => ({ value: m, label: m })),
  ];

  return (
    <div>
      {/* Filter bar */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          {/* Search input */}
          <div className="relative flex-1 min-w-0 sm:min-w-48">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search_placeholder')}
              aria-label={t('search_placeholder')}
              className="w-full pl-9 pr-3 py-2.5 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>

          <Select
            value={country}
            onChange={setCountry}
            options={countryOptions}
            aria-label={t('filter_country')}
            className="sm:w-44"
          />
          <Select
            value={language}
            onChange={setLanguage}
            options={languageOptions}
            aria-label={t('filter_language')}
            className="sm:w-40"
          />
          <Select
            value={major}
            onChange={setMajor}
            options={majorOptions}
            aria-label={t('filter_major')}
            className="sm:w-52"
          />
        </div>

        <div className="flex items-center justify-between mt-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={moeOnly}
              onChange={(e) => setMoeOnly(e.target.checked)}
              className="rounded border-input accent-primary"
              aria-label={t('filter_moe')}
            />
            <span className="text-gold-dark font-medium">★ {t('filter_moe')}</span>
          </label>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-primary transition-colors underline"
            >
              {t('clear_filters')}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center mb-4 text-sm text-muted-foreground">
        <span>{t('results_count', { count: filtered.length })}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <svg
            width="48"
            height="48"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden="true"
            className="mx-auto text-muted-foreground opacity-30"
          >
            <polygon points="32,4 68,4 96,32 96,68 68,96 32,96 4,68 4,32" stroke="currentColor" strokeWidth="2" />
            <polygon points="40,20 60,20 80,40 80,60 60,80 40,80 20,60 20,40" stroke="currentColor" strokeWidth="1" fill="currentColor" fillOpacity="0.1" />
            <polygon points="50,36 64,50 50,64 36,50" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1" />
            <circle cx="50" cy="50" r="5.5" fill="currentColor" />
          </svg>
          <p className="text-muted-foreground mt-4">{t('no_results')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((u) => (
            <UniversityCard key={u.id} university={u} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
