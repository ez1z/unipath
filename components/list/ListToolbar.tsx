'use client';

import { ArrowDown, ArrowUp, Search, X } from 'lucide-react';
import { STATUSES, TIERS, type Status, type Tier } from '@/lib/data/list-types';
import { Select } from '@/components/ui/Select';
import {
  DEADLINE_WINDOWS,
  SORTABLE_COLUMN_IDS,
  activeFilterCount,
  EMPTY_FILTERS,
  type DeadlineWindow,
  type ListFilters,
  type ListView,
  type SortableColumnId,
} from '@/lib/list/view';
import type { Translate } from '@/lib/list/row-view';

type Props = {
  t: Translate;
  filters: ListFilters;
  view: ListView;
  countries: string[];
  shown: number;
  total: number;
  onFilters: (next: ListFilters) => void;
  onView: (next: ListView) => void;
};

const chipCls = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-[13px] font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 whitespace-nowrap ${
    active
      ? 'bg-primary/10 border-primary/40 text-primary'
      : 'bg-card border-input text-muted-foreground hover:border-primary/40 hover:text-foreground'
  }`;

/** Toggling a value in or out of a filter array. */
function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

export function ListToolbar({
  t,
  filters,
  view,
  countries,
  shown,
  total,
  onFilters,
  onView,
}: Props) {
  const active = activeFilterCount(filters);

  return (
    <div className="mb-5 border border-border rounded-xl bg-card/60 p-4 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onFilters({ ...filters, query: e.target.value })}
            placeholder={t('search_placeholder')}
            aria-label={t('search_placeholder')}
            className="w-full bg-card border border-input rounded-lg pl-9 pr-3 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>

        {/* Sorting is driven by column headers on desktop, but the card layout
            has no headers to click — so it needs its own control. */}
        <div className="flex gap-2 sm:w-auto">
          <div className="flex-1 sm:w-52">
            <Select
              value={view.sort?.columnId ?? ''}
              onChange={(v) =>
                onView({
                  sort: v ? { columnId: v as SortableColumnId, dir: view.sort?.dir ?? 'asc' } : null,
                })
              }
              aria-label={t('sort_by')}
              options={[
                { value: '', label: t('sort_manual'), muted: true },
                ...SORTABLE_COLUMN_IDS.map((id) => ({ value: id, label: t(`col_${id}`) })),
              ]}
            />
          </div>
          <button
            type="button"
            disabled={!view.sort}
            onClick={() =>
              view.sort && onView({ sort: { ...view.sort, dir: view.sort.dir === 'asc' ? 'desc' : 'asc' } })
            }
            aria-label={t(view.sort?.dir === 'desc' ? 'sort_desc' : 'sort_asc')}
            className="px-3 rounded-lg bg-card border border-input text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:hover:border-input disabled:hover:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {view.sort?.dir === 'desc' ? (
              <ArrowDown size={16} aria-hidden="true" />
            ) : (
              <ArrowUp size={16} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-dark/60 mr-1">
          {t('filter_tier')}
        </span>
        {TIERS.map((tier: Tier) => (
          <button
            key={tier}
            type="button"
            aria-pressed={filters.tiers.includes(tier)}
            onClick={() => onFilters({ ...filters, tiers: toggle(filters.tiers, tier) })}
            className={chipCls(filters.tiers.includes(tier))}
          >
            {t(`tier_${tier}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-dark/60 mr-1">
          {t('filter_status')}
        </span>
        {STATUSES.map((status: Status) => (
          <button
            key={status}
            type="button"
            aria-pressed={filters.statuses.includes(status)}
            onClick={() => onFilters({ ...filters, statuses: toggle(filters.statuses, status) })}
            className={chipCls(filters.statuses.includes(status))}
          >
            {t(`status_${status}`)}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="sm:w-56">
          <Select
            value={filters.countries[0] ?? ''}
            onChange={(v) => onFilters({ ...filters, countries: v ? [v] : [] })}
            aria-label={t('filter_country')}
            searchable
            size="sm"
            options={[
              { value: '', label: t('filter_country_all'), muted: true },
              ...countries.map((c) => ({ value: c, label: c })),
            ]}
          />
        </div>

        <div className="sm:w-52">
          <Select
            value={filters.deadlineWithin === null ? '' : String(filters.deadlineWithin)}
            onChange={(v) =>
              onFilters({
                ...filters,
                deadlineWithin: (v === '' ? null : v === 'passed' ? 'passed' : Number(v)) as DeadlineWindow,
              })
            }
            aria-label={t('filter_deadline')}
            size="sm"
            options={[
              { value: '', label: t('filter_deadline_any'), muted: true },
              ...DEADLINE_WINDOWS.map((days) => ({
                value: String(days),
                label: t('filter_deadline_days', { days }),
              })),
              { value: 'passed', label: t('filter_deadline_passed') },
            ]}
          />
        </div>

        <button
          type="button"
          aria-pressed={filters.moeOnly}
          onClick={() => onFilters({ ...filters, moeOnly: !filters.moeOnly })}
          className={chipCls(filters.moeOnly)}
        >
          ★ {t('filter_moe')}
        </button>

        {active > 0 && (
          <button
            type="button"
            onClick={() => onFilters(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-crimson hover:bg-crimson-light/40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 whitespace-nowrap"
          >
            <X size={14} strokeWidth={2.5} aria-hidden="true" />
            {t('filters_clear', { count: active })}
          </button>
        )}

        {active > 0 && (
          <span className="text-[13px] text-muted-foreground tabular-nums sm:ml-auto">
            {t('rows_shown', { shown, total })}
          </span>
        )}
      </div>

      {/* Without this, dragging a row while sorted looks broken rather than disabled. */}
      {view.sort && (
        <p className="text-[13px] text-muted-foreground border-t border-border pt-3">
          {t('sort_active_hint', { column: t(`col_${view.sort.columnId}`) })}
        </p>
      )}
    </div>
  );
}
