'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { Scholarship } from '@/lib/data/scholarships';
import { filterScholarships } from '@/lib/data/filter-scholarships';
import { ScholarshipCard } from './ScholarshipCard';
import { BookmarkButton } from '@/components/profile/BookmarkButton';
import { Select } from '@/components/ui/Select';
import type { Locale } from '@/lib/constants';

type Props = {
  scholarships: Scholarship[];
  locale: Locale;
  countries: string[];
  types: string[];
  savedScholarshipIds: string[];
};

const COVERAGE_FILTER_OPTIONS = ['tuition', 'accommodation', 'flights', 'stipend', 'health'];

export function ScholarshipListClient({ scholarships, locale, countries, types, savedScholarshipIds }: Props) {
  const t = useTranslations('scholarships');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [type, setType] = useState('');
  const [coverage, setCoverage] = useState('');

  const filtered = useMemo(
    () =>
      filterScholarships(scholarships, {
        query: query || undefined,
        country: country || undefined,
        type: type || undefined,
        coverage: coverage || undefined,
      }),
    [scholarships, query, country, type, coverage]
  );

  function clearFilters() {
    setQuery('');
    setCountry('');
    setType('');
    setCoverage('');
  }

  const hasFilters = query || country || type || coverage;

  const countryOptions = [
    { value: '', label: t('filter_all_countries'), muted: true },
    ...countries.map((c) => ({ value: c, label: c })),
  ];

  const TYPE_LABELS: Record<string, string> = {
    government: t('type_government'),
    merit: t('type_merit'),
    'need-based': t('type_need_based'),
    partial: t('type_partial'),
  };

  const COVERAGE_LABELS: Record<string, string> = {
    tuition: t('coverage_tuition'),
    accommodation: t('coverage_accommodation'),
    flights: t('coverage_flights'),
    stipend: t('coverage_stipend'),
    health: t('coverage_health'),
  };

  const typeOptions = [
    { value: '', label: t('filter_all_types'), muted: true },
    ...types.map((tp) => ({
      value: tp,
      label: TYPE_LABELS[tp] ?? tp,
    })),
  ];

  const coverageOptions = [
    { value: '', label: t('filter_all_coverage'), muted: true },
    ...COVERAGE_FILTER_OPTIONS.map((c) => ({
      value: c,
      label: COVERAGE_LABELS[c] ?? c,
    })),
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
            value={type}
            onChange={setType}
            options={typeOptions}
            aria-label={t('filter_type')}
            className="sm:w-44"
          />
          <Select
            value={coverage}
            onChange={setCoverage}
            options={coverageOptions}
            aria-label={t('filter_coverage')}
            className="sm:w-52"
          />
        </div>

        {hasFilters && (
          <div className="flex justify-end mt-3">
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-primary transition-colors underline"
            >
              {t('clear_filters')}
            </button>
          </div>
        )}
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
          {filtered.map((s) => (
            <ScholarshipCard
              key={s.id}
              scholarship={s}
              locale={locale}
              bookmarkSlot={
                <BookmarkButton
                  type="scholarship"
                  id={s.id}
                  initialSaved={savedScholarshipIds.includes(s.id)}
                  locale={locale}
                  size="card"
                />
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
