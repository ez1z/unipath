'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { Scholarship } from '@/lib/data/scholarships';
import { filterScholarships } from '@/lib/data/filter-scholarships';
import type { ScholarshipSortBy } from '@/lib/data/scholarship-types';
import { getNextDeadline } from '@/lib/types/semester';
import { ScholarshipCard } from './ScholarshipCard';
import { BookmarkButton } from '@/components/profile/BookmarkButton';
import { Select } from '@/components/ui/Select';
import type { Locale } from '@/lib/constants';

type UserPrefs = { countries: string[] };

type Props = {
  scholarships: Scholarship[];
  locale: Locale;
  countries: string[];
  types: string[];
  savedScholarshipIds: string[];
  userPrefs: UserPrefs | null;
  qualifiedUniversityIds: string[] | null;
};

const COVERAGE_FILTER_OPTIONS = ['tuition', 'accommodation', 'flights', 'stipend', 'health'];

export function ScholarshipListClient({
  scholarships,
  locale,
  countries,
  types,
  savedScholarshipIds,
  userPrefs,
  qualifiedUniversityIds,
}: Props) {
  const t = useTranslations('scholarships');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('');
  const [type, setType] = useState('');
  const [coverage, setCoverage] = useState('');
  const [hasAmount, setHasAmount] = useState(false);
  const [minAmount, setMinAmount] = useState('');
  const [deadlineStatus, setDeadlineStatus] = useState('');
  const [sortBy, setSortBy] = useState<ScholarshipSortBy>('name');
  const [prefsActive, setPrefsActive] = useState(false);
  const [scoresActive, setScoresActive] = useState(false);

  const hasPrefs = userPrefs !== null && userPrefs.countries.length > 0;
  const hasScores = qualifiedUniversityIds !== null;

  const qualifiedSet = useMemo(
    () => (qualifiedUniversityIds ? new Set(qualifiedUniversityIds) : null),
    [qualifiedUniversityIds],
  );

  const basePool = useMemo(() => {
    let pool = scholarships;
    if (prefsActive && userPrefs) {
      pool = pool.filter((s) =>
        userPrefs.countries.length === 0 || userPrefs.countries.includes(s.country),
      );
    }
    if (scoresActive && qualifiedSet) {
      pool = pool.filter((s) => s.university_id === null || qualifiedSet.has(s.university_id));
    }
    return pool;
  }, [scholarships, prefsActive, userPrefs, scoresActive, qualifiedSet]);

  const filtered = useMemo(
    () =>
      filterScholarships(basePool, {
        query: query || undefined,
        country: country || undefined,
        type: type || undefined,
        coverage: coverage || undefined,
        hasAmount,
        minAmount: minAmount ? Number(minAmount) : undefined,
        deadlineStatus: (deadlineStatus as 'upcoming' | 'passed') || undefined,
      }),
    [basePool, query, country, type, coverage, hasAmount, minAmount, deadlineStatus],
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case 'amount_desc':
        return arr.sort((a, b) => {
          if (a.amount_usd === null && b.amount_usd === null) return 0;
          if (a.amount_usd === null) return 1;
          if (b.amount_usd === null) return -1;
          return b.amount_usd - a.amount_usd;
        });
      case 'amount_asc':
        return arr.sort((a, b) => {
          if (a.amount_usd === null && b.amount_usd === null) return 0;
          if (a.amount_usd === null) return 1;
          if (b.amount_usd === null) return -1;
          return a.amount_usd - b.amount_usd;
        });
      case 'deadline_asc':
        return arr.sort((a, b) => {
          const da = getNextDeadline(a.semesters);
          const db = getNextDeadline(b.semesters);
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return da.localeCompare(db);
        });
      case 'deadline_desc':
        return arr.sort((a, b) => {
          const da = getNextDeadline(a.semesters);
          const db = getNextDeadline(b.semesters);
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return db.localeCompare(da);
        });
      default:
        return arr.sort((a, b) => a.name.en.localeCompare(b.name.en));
    }
  }, [filtered, sortBy]);

  function clearFilters() {
    setQuery('');
    setCountry('');
    setType('');
    setCoverage('');
    setHasAmount(false);
    setMinAmount('');
    setDeadlineStatus('');
    setSortBy('name');
  }

  const hasFilters =
    query || country || type || coverage || hasAmount || minAmount ||
    deadlineStatus || sortBy !== 'name';
  const hasActivePersonalization = prefsActive || scoresActive;

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

  const deadlineStatusOptions = [
    { value: '', label: t('filter_deadline_all'), muted: true },
    { value: 'upcoming', label: t('filter_deadline_upcoming') },
    { value: 'passed', label: t('filter_deadline_passed') },
  ];

  const sortOptions: { value: ScholarshipSortBy; label: string }[] = [
    { value: 'name', label: t('sort_name') },
    { value: 'amount_desc', label: t('sort_amount_desc') },
    { value: 'amount_asc', label: t('sort_amount_asc') },
    { value: 'deadline_asc', label: t('sort_deadline_asc') },
    { value: 'deadline_desc', label: t('sort_deadline_desc') },
  ];

  return (
    <div>
      {/* Filter bar */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          {/* Search */}
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

          {/* Min amount input */}
          <div className="relative sm:w-44">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">
              $
            </span>
            <input
              type="number"
              min="0"
              step="500"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder={t('filter_min_amount')}
              aria-label={t('filter_min_amount')}
              className="w-full pl-7 pr-3 py-2.5 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <Select
            value={deadlineStatus}
            onChange={setDeadlineStatus}
            options={deadlineStatusOptions}
            aria-label={t('filter_deadline')}
            className="sm:w-40"
          />
          <Select
            value={sortBy}
            onChange={(v) => setSortBy(v as ScholarshipSortBy)}
            options={sortOptions}
            aria-label={t('sort_label')}
            className="sm:w-48"
          />
        </div>

        <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasAmount}
                onChange={(e) => setHasAmount(e.target.checked)}
                className="rounded border-input accent-primary"
                aria-label={t('filter_has_amount')}
              />
              <span className="text-muted-foreground">{t('filter_has_amount')}</span>
            </label>

            {hasPrefs && (
              <button
                type="button"
                onClick={() => setPrefsActive((v) => !v)}
                aria-pressed={prefsActive}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  prefsActive
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                }`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill={prefsActive ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {t('filter_my_preferences')}
              </button>
            )}

            {hasScores && (
              <button
                type="button"
                onClick={() => setScoresActive((v) => !v)}
                aria-pressed={scoresActive}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  scoresActive
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                }`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
                {t('filter_my_results')}
              </button>
            )}
          </div>

          {(hasFilters || hasActivePersonalization) && (
            <button
              onClick={() => { clearFilters(); setPrefsActive(false); setScoresActive(false); }}
              className="text-xs text-muted-foreground hover:text-primary transition-colors underline"
            >
              {t('clear_filters')}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center mb-4 text-sm text-muted-foreground">
        <span>{t('results_count', { count: sorted.length })}</span>
      </div>

      {sorted.length === 0 ? (
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
          {sorted.map((s) => (
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
