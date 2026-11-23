import { formatTuition } from '@/lib/format';

/** One removable "active filter" chip; `key` is what the list's remove handler switches on. */
export type FilterChip = { key: string; label: string };

/** A translator already scoped to the list's namespace (`useTranslations('scholarships')` etc.). */
type Translate = (key: string) => string;

const DEADLINE_KEYS: Record<string, string> = {
  upcoming: 'filter_deadline_upcoming',
  passed: 'filter_deadline_passed',
};

const SCHOLARSHIP_TYPE_KEYS: Record<string, string> = {
  government: 'type_government',
  merit: 'type_merit',
  'need-based': 'type_need_based',
  partial: 'type_partial',
};

const COVERAGE_KEYS: Record<string, string> = {
  tuition: 'coverage_tuition',
  accommodation: 'coverage_accommodation',
  flights: 'coverage_flights',
  stipend: 'coverage_stipend',
  health: 'coverage_health',
};

/** Looks up a value's label, falling back to the raw value for anything unknown. */
function lookup(t: Translate, keys: Record<string, string>, value: string): string {
  const key = keys[value];
  return key ? t(key) : value;
}

/** "Label: $5,000 / 17,550 TMT" — money is always shown in both currencies (README domain rule). */
function moneyLabel(t: Translate, labelKey: string, value: string): string | null {
  const n = Number(value);
  if (value === '' || !Number.isFinite(n)) return null;
  return `${t(labelKey)}: ${formatTuition(n)}`;
}

export type ScholarshipChipFilters = {
  country: string;
  type: string;
  coverage: string;
  minAmount: string;
  deadlineStatus: string;
  hasAmount: boolean;
  /** Pass the effective state (active AND available to this viewer). */
  prefs: boolean;
  scores: boolean;
};

export function buildScholarshipFilterChips(f: ScholarshipChipFilters, t: Translate): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.country) chips.push({ key: 'country', label: f.country });
  if (f.type) chips.push({ key: 'type', label: `${t('filter_type')}: ${lookup(t, SCHOLARSHIP_TYPE_KEYS, f.type)}` });
  if (f.coverage) chips.push({ key: 'coverage', label: `${t('filter_coverage')}: ${lookup(t, COVERAGE_KEYS, f.coverage)}` });
  const minAmount = moneyLabel(t, 'filter_min_amount', f.minAmount);
  if (minAmount) chips.push({ key: 'minAmount', label: minAmount });
  if (f.deadlineStatus) {
    chips.push({ key: 'deadline', label: `${t('filter_deadline')}: ${lookup(t, DEADLINE_KEYS, f.deadlineStatus)}` });
  }
  if (f.hasAmount) chips.push({ key: 'amount', label: t('filter_has_amount') });
  if (f.prefs) chips.push({ key: 'prefs', label: t('filter_my_preferences') });
  if (f.scores) chips.push({ key: 'scores', label: t('filter_my_results') });
  return chips;
}

export type UniversityChipFilters = {
  country: string;
  language: string;
  major: string;
  maxTuition: string;
  deadlineStatus: string;
  moeOnly: boolean;
  rankedOnly: boolean;
  /** Pass the effective state (active AND available to this viewer). */
  prefs: boolean;
  scores: boolean;
};

export function buildUniversityFilterChips(f: UniversityChipFilters, t: Translate): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.country) chips.push({ key: 'country', label: f.country });
  if (f.language) chips.push({ key: 'language', label: `${t('filter_language')}: ${f.language.toUpperCase()}` });
  if (f.major) chips.push({ key: 'major', label: f.major });
  const maxTuition = moneyLabel(t, 'filter_max_tuition', f.maxTuition);
  if (maxTuition) chips.push({ key: 'maxTuition', label: maxTuition });
  if (f.deadlineStatus) {
    chips.push({ key: 'deadline', label: `${t('filter_deadline')}: ${lookup(t, DEADLINE_KEYS, f.deadlineStatus)}` });
  }
  if (f.moeOnly) chips.push({ key: 'moe', label: t('filter_moe') });
  if (f.rankedOnly) chips.push({ key: 'ranked', label: t('filter_ranked_only') });
  if (f.prefs) chips.push({ key: 'prefs', label: t('filter_my_preferences') });
  if (f.scores) chips.push({ key: 'scores', label: t('filter_my_results') });
  return chips;
}
