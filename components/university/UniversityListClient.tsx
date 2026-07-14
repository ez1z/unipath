'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { trackEvent } from '@/lib/analytics/track';
import type { University } from '@/lib/data/universities';
import { filterUniversities } from '@/lib/data/filter-universities';
import type { UniversitySortBy } from '@/lib/data/university-types';
import { getNextDeadline } from '@/lib/types/semester';
import { UniversityCard } from './UniversityCard';
import { BookmarkButton } from '@/components/profile/BookmarkButton';
import { Select } from '@/components/ui/Select';
import { FilterSheet } from '@/components/ui/FilterSheet';
import { SlidersHorizontal } from 'lucide-react';
import type { Locale } from '@/lib/constants';

type UserPrefs = { countries: string[]; majors: string[] };
type UserScores = { toefl: number | null; ielts: number | null; sat: number | null; duolingo: number | null };

type TestEntry = { type: string; min_score?: number; min_math?: number; min_verbal?: number };

function meetsTestRequirements(university: University, scores: UserScores): boolean {
  const tests = Array.isArray(university.entrance_requirements?.tests)
    ? (university.entrance_requirements.tests as TestEntry[])
    : [];
  if (tests.length === 0) return true;
  return tests.some((test) => {
    if (test.type === 'toefl') return scores.toefl != null && scores.toefl >= (test.min_score ?? 0);
    if (test.type === 'ielts') return scores.ielts != null && scores.ielts >= (test.min_score ?? 0);
    if (test.type === 'sat') {
      if (scores.sat == null) return false;
      return scores.sat >= (test.min_math ?? 0) + (test.min_verbal ?? 0);
    }
    if (test.type === 'duolingo') return scores.duolingo != null && scores.duolingo >= (test.min_score ?? 0);
    return false;
  });
}

type Props = {
  universities: University[];
  locale: Locale;
  countries: string[];
  languages: string[];
  majors: string[];
  savedUniversityIds: string[];
  scholarshipEligibleIds: string[];
  userPrefs: UserPrefs | null;
  userScores: UserScores | null;
};

export function UniversityListClient({
  universities,
  locale,
  countries,
  languages,
  majors,
  savedUniversityIds,
  scholarshipEligibleIds,
  userPrefs,
  userScores,
}: Props) {
  const t = useTranslations('universities');

  // Filters are mirrored to the URL query string so the exact filtered view is
  // preserved across navigation. When the user opens a university and presses
  // "back", the browser restores this URL and the state below re-initialises
  // from it — instead of resetting to the unfiltered list.
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [country, setCountry] = useState(() => searchParams.get('country') ?? '');
  const [language, setLanguage] = useState(() => searchParams.get('language') ?? '');
  const [major, setMajor] = useState(() => searchParams.get('major') ?? '');
  const [moeOnly, setMoeOnly] = useState(() => searchParams.get('moe') === '1');
  const [rankedOnly, setRankedOnly] = useState(() => searchParams.get('ranked') === '1');
  const [maxTuition, setMaxTuition] = useState(() => searchParams.get('maxTuition') ?? '');
  const [deadlineStatus, setDeadlineStatus] = useState(() => searchParams.get('deadline') ?? '');
  const [sortBy, setSortBy] = useState<UniversitySortBy>(
    () => (searchParams.get('sort') as UniversitySortBy) || 'name',
  );
  const [prefsActive, setPrefsActive] = useState(() => searchParams.get('prefs') === '1');
  const [scoresActive, setScoresActive] = useState(() => searchParams.get('scores') === '1');
  const [sheetOpen, setSheetOpen] = useState(false);

  // Single source of truth for the active filters as a query string. Reused for
  // both the URL sync below and the per-card links, so opening a university and
  // pressing "back" returns to the exact filtered view.
  const filtersQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (country) params.set('country', country);
    if (language) params.set('language', language);
    if (major) params.set('major', major);
    if (moeOnly) params.set('moe', '1');
    if (rankedOnly) params.set('ranked', '1');
    if (maxTuition) params.set('maxTuition', maxTuition);
    if (deadlineStatus) params.set('deadline', deadlineStatus);
    if (sortBy !== 'name') params.set('sort', sortBy);
    if (prefsActive) params.set('prefs', '1');
    if (scoresActive) params.set('scores', '1');
    return params.toString();
  }, [query, country, language, major, moeOnly, rankedOnly, maxTuition, deadlineStatus, sortBy, prefsActive, scoresActive]);

  // Keep the URL in sync with the active filters. We use the native History API
  // (integrated with the Next.js router in 14.2+) rather than router.replace so
  // that typing in the search box doesn't trigger a server round-trip on every
  // keystroke — the list is already filtered entirely on the client.
  useEffect(() => {
    window.history.replaceState(null, '', filtersQuery ? `${pathname}?${filtersQuery}` : pathname);
  }, [filtersQuery, pathname]);

  // Log search terms (debounced) for the admin analytics dashboard. Filtering is
  // client-side, so this is the only place a query is observable server-side.
  const lastLoggedQuery = useRef(query.trim().toLowerCase());
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || term.toLowerCase() === lastLoggedQuery.current) return;
    const handle = setTimeout(() => {
      lastLoggedQuery.current = term.toLowerCase();
      trackEvent({ event_type: 'search', search_query: term, locale });
    }, 1000);
    return () => clearTimeout(handle);
  }, [query, locale]);

  const scholarshipSet = useMemo(() => new Set(scholarshipEligibleIds), [scholarshipEligibleIds]);

  const hasPrefs =
    userPrefs !== null &&
    (userPrefs.countries.length > 0 ||
      userPrefs.majors.length > 0 ||
      savedUniversityIds.length > 0);

  const hasScores =
    userScores !== null &&
    (userScores.toefl != null || userScores.ielts != null ||
      userScores.sat != null || userScores.duolingo != null);

  const basePool = useMemo(() => {
    let pool = universities;
    if (prefsActive && userPrefs) {
      pool = pool.filter((u) => {
        if (savedUniversityIds.includes(u.id)) return true;
        const countryOk =
          userPrefs.countries.length === 0 || userPrefs.countries.includes(u.country);
        const majorOk =
          userPrefs.majors.length === 0 ||
          u.majors.some((m) =>
            userPrefs.majors.some((pm) =>
              m.toLowerCase().includes(pm.toLowerCase()),
            ),
          );
        return countryOk && majorOk;
      });
    }
    if (scoresActive && userScores) {
      pool = pool.filter((u) => meetsTestRequirements(u, userScores));
    }
    return pool;
  }, [universities, prefsActive, userPrefs, savedUniversityIds, scoresActive, userScores]);

  const filtered = useMemo(
    () =>
      filterUniversities(basePool, {
        query: query || undefined,
        country: country || undefined,
        language: language || undefined,
        major: major || undefined,
        moeOnly,
        rankedOnly,
        maxTuition: maxTuition ? Number(maxTuition) : undefined,
        deadlineStatus: (deadlineStatus as 'upcoming' | 'passed') || undefined,
      }),
    [basePool, query, country, language, major, moeOnly, rankedOnly, maxTuition, deadlineStatus],
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case 'ranking':
        return arr.sort((a, b) => {
          if (a.ranking_qs === null && b.ranking_qs === null) return 0;
          if (a.ranking_qs === null) return 1;
          if (b.ranking_qs === null) return -1;
          return a.ranking_qs - b.ranking_qs;
        });
      case 'tuition_asc':
        return arr.sort((a, b) => a.tuition_usd - b.tuition_usd);
      case 'tuition_desc':
        return arr.sort((a, b) => b.tuition_usd - a.tuition_usd);
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
    setLanguage('');
    setMajor('');
    setMoeOnly(false);
    setRankedOnly(false);
    setMaxTuition('');
    setDeadlineStatus('');
    setSortBy('name');
  }

  const hasFilters =
    query || country || language || major || moeOnly || rankedOnly ||
    maxTuition || deadlineStatus || sortBy !== 'name';
  const hasActivePersonalization = prefsActive || scoresActive;

  // Fields that live inside the filter sheet (excludes search + sort, which
  // stay on the visible bar) — drives the badge count on the filter icon.
  const sheetFilterCount =
    [country, language, major, maxTuition, deadlineStatus].filter(Boolean).length +
    (moeOnly ? 1 : 0) + (rankedOnly ? 1 : 0) +
    (prefsActive ? 1 : 0) + (scoresActive ? 1 : 0);

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
  const deadlineStatusOptions = [
    { value: '', label: t('filter_deadline_all'), muted: true },
    { value: 'upcoming', label: t('filter_deadline_upcoming') },
    { value: 'passed', label: t('filter_deadline_passed') },
  ];
  const sortOptions: { value: UniversitySortBy; label: string }[] = [
    { value: 'name', label: t('sort_name') },
    { value: 'ranking', label: t('sort_ranking') },
    { value: 'tuition_asc', label: t('sort_tuition_asc') },
    { value: 'tuition_desc', label: t('sort_tuition_desc') },
    { value: 'deadline_asc', label: t('sort_deadline_asc') },
    { value: 'deadline_desc', label: t('sort_deadline_desc') },
  ];

  return (
    <div>
      {/* Filter bar */}
      <div className="flex gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
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

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label={t('filters_button')}
          className="relative flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 border border-input rounded-lg text-sm bg-card hover:border-primary/40 transition-colors"
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span className="hidden sm:inline">{t('filters_button')}</span>
          {sheetFilterCount > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold leading-none">
              {sheetFilterCount}
            </span>
          )}
        </button>

        <Select
          value={sortBy}
          onChange={(v) => setSortBy(v as UniversitySortBy)}
          options={sortOptions}
          aria-label={t('sort_label')}
          className="w-32 sm:w-48 flex-shrink-0"
        />
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('filters_title')}
        closeLabel={t('filters_close')}
        clearLabel={t('filters_clear_all')}
        applyLabel={t('filters_show_results', { count: sorted.length })}
        onClear={() => { clearFilters(); setPrefsActive(false); setScoresActive(false); }}
        hasFilters={Boolean(hasFilters || hasActivePersonalization)}
      >
        <Select
          value={country}
          onChange={setCountry}
          options={countryOptions}
          aria-label={t('filter_country')}
          searchable
        />
        <Select
          value={language}
          onChange={setLanguage}
          options={languageOptions}
          aria-label={t('filter_language')}
          searchable
        />
        <Select
          value={major}
          onChange={setMajor}
          options={majorOptions}
          aria-label={t('filter_major')}
          searchable
        />

        {/* Max tuition input */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">
            $
          </span>
          <input
            type="number"
            min="0"
            step="500"
            value={maxTuition}
            onChange={(e) => setMaxTuition(e.target.value)}
            placeholder={t('filter_max_tuition')}
            aria-label={t('filter_max_tuition')}
            className="w-full pl-7 pr-3 py-2.5 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>

        <Select
          value={deadlineStatus}
          onChange={setDeadlineStatus}
          options={deadlineStatusOptions}
          aria-label={t('filter_deadline')}
        />

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

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rankedOnly}
            onChange={(e) => setRankedOnly(e.target.checked)}
            className="rounded border-input accent-primary"
            aria-label={t('filter_ranked_only')}
          />
          <span className="text-muted-foreground">{t('filter_ranked_only')}</span>
        </label>

        {(hasPrefs || hasScores) && (
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border">
            {hasPrefs && (
              <button
                type="button"
                onClick={() => setPrefsActive((v) => !v)}
                aria-pressed={prefsActive}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 mt-3 rounded-lg text-xs font-semibold border transition-colors ${
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 mt-3 rounded-lg text-xs font-semibold border transition-colors ${
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
        )}
      </FilterSheet>

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
          {sorted.map((u) => (
            <UniversityCard
              key={u.id}
              university={u}
              locale={locale}
              filtersQuery={filtersQuery}
              hasScholarships={scholarshipSet.has(u.id)}
              bookmarkSlot={
                <BookmarkButton
                  type="university"
                  id={u.id}
                  initialSaved={savedUniversityIds.includes(u.id)}
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
