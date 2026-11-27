/**
 * Filter groups and removable chips for the search and scholarship pages,
 * built on the server from the parsed filters. The FilterPanel island only
 * renders what it is given.
 */
import type { Lang, MessageKey, Translate } from '../../i18n';
import type { CountryOption } from '../db/catalog.ts';
import { COVERAGES, FIELDS, MINISTRY_STATUSES, PROGRAM_LEVELS } from '../db/values.ts';
import { languageName, formatUsd } from '../format.ts';
import { LENGTH_BUCKETS, TOTAL_YEARS_FILTERS } from '../paths.ts';
import { fieldLabel, levelLabel, ministryLabel } from '../view.ts';
import type { FilterGroup } from '../../islands/FilterPanel.tsx';
import {
  PARAM,
  type ProgramFilters,
  type ScholarshipFilters,
  type UniversityFilters,
} from './filters.ts';

export interface Chip {
  label: string;
  /** The same page without this one filter value. */
  href: string;
}

const option = (value: string, label: string, checked: boolean, hint?: string) =>
  hint ? { value, label, checked, hint } : { value, label, checked };

function countryGroup(t: Translate, countries: CountryOption[], selected: string[]): FilterGroup {
  return {
    kind: 'checkbox',
    name: PARAM.country,
    legend: t('filter.country'),
    options: countries.map((c) =>
      option(
        c.code,
        c.name.text,
        selected.includes(c.code),
        c.name.fallback ? t('common.notTranslated') : undefined,
      ),
    ),
  };
}

export function programFilterGroups(
  t: Translate,
  lang: Lang,
  f: ProgramFilters,
  countries: CountryOption[],
  languages: string[],
): FilterGroup[] {
  return [
    {
      kind: 'checkbox',
      name: PARAM.level,
      legend: t('filter.level'),
      options: PROGRAM_LEVELS.map((l) => option(l, levelLabel(t, l), f.levels.includes(l))),
    },
    {
      kind: 'checkbox',
      name: PARAM.length,
      legend: t('filter.length'),
      options: LENGTH_BUCKETS.map((b) =>
        option(b, t(`filter.length.${b}` as MessageKey), f.lengths.includes(b)),
      ),
    },
    {
      kind: 'radio',
      name: PARAM.total,
      legend: t('filter.total'),
      options: [
        option('', t('filter.total.any'), f.total === null),
        ...TOTAL_YEARS_FILTERS.map((v) =>
          option(v, t(`filter.total.${v}` as MessageKey), f.total === v),
        ),
      ],
    },
    countryGroup(t, countries, f.countries),
    {
      kind: 'checkbox',
      name: PARAM.approved,
      legend: t('filter.status'),
      options: [option('1', t('filter.approvedOnly'), f.approvedOnly)],
    },
    {
      kind: 'range',
      legend: t('filter.cost'),
      min: { name: PARAM.tuitionMin, label: t('filter.minTuition'), value: f.tuitionMin },
      max: { name: PARAM.tuitionMax, label: t('filter.maxTuition'), value: f.tuitionMax },
    },
    {
      kind: 'checkbox',
      name: PARAM.field,
      legend: t('filter.field'),
      options: FIELDS.map((v) => option(v, fieldLabel(t, v), f.fields.includes(v))),
    },
    {
      kind: 'checkbox',
      name: PARAM.language,
      legend: t('filter.language'),
      options: languages.map((code) =>
        option(code, languageName(lang, code), f.languages.includes(code)),
      ),
    },
    {
      kind: 'checkbox',
      name: PARAM.scholarships,
      legend: t('filter.funding'),
      options: [option('1', t('filter.hasScholarships'), f.hasScholarships)],
    },
  ];
}

export function universityFilterGroups(
  t: Translate,
  f: UniversityFilters,
  countries: CountryOption[],
): FilterGroup[] {
  return [
    countryGroup(t, countries, f.countries),
    {
      kind: 'checkbox',
      name: PARAM.status,
      legend: t('filter.status'),
      options: MINISTRY_STATUSES.map((s) => option(s, ministryLabel(t, s), f.statuses.includes(s))),
    },
    {
      kind: 'checkbox',
      name: PARAM.foundation,
      legend: t('filter.level'),
      options: [option('1', t('filter.hasFoundation'), f.hasFoundationYear)],
    },
    {
      kind: 'checkbox',
      name: PARAM.scholarships,
      legend: t('filter.funding'),
      options: [option('1', t('filter.hasScholarships'), f.hasScholarships)],
    },
  ];
}

export function scholarshipFilterGroups(
  t: Translate,
  f: ScholarshipFilters,
  countries: CountryOption[],
): FilterGroup[] {
  return [
    countryGroup(t, countries, f.countries),
    {
      kind: 'checkbox',
      name: PARAM.coverage,
      legend: t('filter.coverage'),
      options: COVERAGES.map((c) =>
        option(c, t(`coverage.${c}` as MessageKey), f.coverages.includes(c)),
      ),
    },
    {
      kind: 'checkbox',
      name: PARAM.preYear,
      legend: t('summary.preYear'),
      options: [option('1', t('filter.coversPreYear'), f.coversPreYear)],
    },
    {
      kind: 'checkbox',
      name: PARAM.turkmen,
      legend: t('filter.whoCanApply'),
      options: [option('1', t('filter.openToTurkmen'), f.openToTurkmen)],
    },
    {
      kind: 'checkbox',
      name: PARAM.closed,
      legend: t('deadline.closed'),
      options: [option('1', t('filter.closed'), f.includeClosed)],
    },
  ];
}

/**
 * One removable chip per set filter value. `base` is the page's canonical
 * query; each chip links to it without that one value (and back to page 1).
 */
export function filterChips(
  t: Translate,
  lang: Lang,
  path: string,
  base: URLSearchParams,
  groups: FilterGroup[],
): Chip[] {
  const without = (key: string, value: string) => {
    const next = new URLSearchParams();
    for (const [k, v] of base)
      if (!(k === key && v === value) && k !== PARAM.page) next.append(k, v);
    const query = next.toString();
    return query ? `${path}?${query}` : path;
  };
  const chips: Chip[] = [];
  for (const group of groups) {
    if (group.kind === 'range') {
      if (group.min.value !== null) {
        chips.push({
          label: t('filter.chip.min', { amount: formatUsd(lang, group.min.value) }),
          href: without(group.min.name, String(group.min.value)),
        });
      }
      if (group.max.value !== null) {
        chips.push({
          label: t('filter.chip.max', { amount: formatUsd(lang, group.max.value) }),
          href: without(group.max.name, String(group.max.value)),
        });
      }
      continue;
    }
    for (const o of group.options) {
      if (o.checked && o.value !== '') {
        chips.push({ label: o.label, href: without(group.name, o.value) });
      }
    }
  }
  return chips;
}
