'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Columns3, Download } from 'lucide-react';
import type { Locale } from '@/lib/constants';
import type { University } from '@/lib/data/university-types';
import type { Scholarship } from '@/lib/data/scholarship-types';
import type { ColumnDef, ListEntry } from '@/lib/data/list-types';
import { visibleColumns } from '@/lib/data/list-types';
import { suggestTier, type FitProfile } from '@/lib/data/fit';
import { Select } from '@/components/ui/Select';
import { docsProgress, resolveDocs, type Translate as DocsTranslate } from '@/lib/docs/resolve';
import { MAX_CUSTOM_DOCS, type DocItem, type DocsDiffMap } from '@/lib/docs/types';
import { useDocsState } from '@/lib/docs/useDocsState';
import {
  applyView,
  EMPTY_FILTERS,
  isSortable,
  type ListFilters,
  type ListView,
  type SortableColumnId,
} from '@/lib/list/view';
import {
  buildRow,
  cellText,
  columnLabel,
  moneyText,
  universityName,
  type RowContext,
  type Translate,
} from '@/lib/list/row-view';
import type { ExportFormat } from '@/lib/list/export';
import { useListState } from './useListState';
import { ListTable } from './ListTable';
import { ListCards } from './ListCards';
import { ListToolbar } from './ListToolbar';
import { ColumnManager } from './ColumnManager';

type Props = {
  locale: Locale;
  isSignedIn: boolean;
  universities: University[];
  scholarships: Scholarship[];
  initialEntries: ListEntry[];
  initialColumns: ColumnDef[];
  initialView: ListView;
  docsDiffs: DocsDiffMap;
  profile: FitProfile | null;
};

export function ListClient({
  locale,
  isSignedIn,
  universities,
  scholarships,
  initialEntries,
  initialColumns,
  initialView,
  docsDiffs,
  profile,
}: Props) {
  // Cell keys are built at runtime (`col_${id}`, `tier_${x}`), so the strict
  // key typing has to be relaxed once, here at the boundary.
  const t = useTranslations('list') as unknown as Translate;
  const tDocs = useTranslations('checklist') as unknown as DocsTranslate;

  const [showColumns, setShowColumns] = useState(false);
  const [exportError, setExportError] = useState(false);
  // Filters are session state on purpose: a filter that survived a reload would
  // be invisible state that reads as missing universities.
  const [filters, setFilters] = useState<ListFilters>(EMPTY_FILTERS);

  const {
    entries,
    columns,
    view,
    saveState,
    limitReached,
    addEntry,
    updateEntry,
    removeEntry,
    reorderRows,
    updateColumns,
    updateView,
  } = useListState({ locale, isSignedIn, initialEntries, initialColumns, initialView });

  const docs = useDocsState({ locale, isSignedIn, initial: docsDiffs });

  const universitiesById = useMemo(
    () => new Map(universities.map((u) => [u.id, u])),
    [universities],
  );
  const scholarshipsById = useMemo(
    () => new Map(scholarships.map((s) => [s.id, s])),
    [scholarships],
  );

  const ctx: RowContext = useMemo(
    () => ({ locale, t, scholarshipsById }),
    [locale, t, scholarshipsById],
  );

  /**
   * Checklists are derived, not stored, so every row has one from the moment it
   * is added — including for signed-out students, whose diffs come from
   * localStorage rather than the server.
   */
  const docItems = useMemo(() => {
    const map = new Map<string, DocItem[]>();
    for (const entry of entries) {
      const uni = universitiesById.get(entry.university_id);
      if (!uni) continue;
      map.set(
        entry.university_id,
        resolveDocs(uni.entrance_requirements, docs.diffOf(entry.university_id), tDocs),
      );
    }
    return map;
    // `diffOf` is memoised on the diffs themselves, so depending on it rebuilds
    // exactly when a checklist actually changes.
  }, [entries, universitiesById, docs.diffOf, tDocs]);

  const rows = useMemo(
    () =>
      entries
        .map((entry) => {
          const uni = universitiesById.get(entry.university_id);
          if (!uni) return null;
          const items = docItems.get(entry.university_id) ?? [];
          return buildRow(
            entry,
            uni,
            suggestTier(uni, profile),
            docsProgress(items),
            scholarshipsById,
          );
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    [entries, universitiesById, scholarshipsById, docItems, profile],
  );

  const visible = useMemo(
    () => applyView(rows, view, filters, locale),
    [rows, view, filters, locale],
  );

  const shown = useMemo(() => visibleColumns(columns), [columns]);

  const countries = useMemo(
    () => [...new Set(rows.map((r) => r.university.country))].sort((a, b) => a.localeCompare(b, locale)),
    [rows, locale],
  );

  const addOptions = useMemo(() => {
    const taken = new Set(entries.map((e) => e.university_id));
    return [
      { value: '', label: t('add_placeholder'), muted: true },
      ...universities
        .filter((u) => !taken.has(u.id))
        .map((u) => ({ value: u.id, label: `${universityName(u, locale)} — ${u.country}` })),
    ];
  }, [universities, entries, locale, t]);

  const summary = useMemo(() => {
    const tiers = { dream: 0, target: 0, safety: 0 };
    let totalUsd = 0;
    let overBudget = 0;
    for (const row of visible) {
      const tier = row.entry.tier ?? row.fit.tier;
      if (tier) tiers[tier]++;
      // The label reads "total tuition", so sum tuition — not net cost.
      totalUsd += row.university.tuition_usd;
      if (row.fit.flags.some((f) => f.code === 'over_budget')) overBudget++;
    }
    return { tiers, totalUsd, overBudget };
  }, [visible]);

  /** asc → desc → back to the student's manual order. */
  function handleSort(columnId: string) {
    if (!isSortable(columnId)) return;
    const id = columnId as SortableColumnId;

    if (view.sort?.columnId !== id) return updateView({ sort: { columnId: id, dir: 'asc' } });
    if (view.sort.dir === 'asc') return updateView({ sort: { columnId: id, dir: 'desc' } });
    updateView({ sort: null });
  }

  async function handleExport(format: ExportFormat) {
    setExportError(false);
    const headers = shown.map((c) => columnLabel(c, t));
    // Exports what is on screen, filters and sort included — the file has to
    // match what the student was looking at when they clicked.
    const body = visible.map((row) => shown.map((c) => cellText(c, row, ctx)));

    try {
      const response = await fetch(`/${locale}/compare/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, headers, rows: body, filename: 'unipath-list' }),
      });
      if (!response.ok) throw new Error('export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `unipath-list.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
    }
  }

  const sharedProps = {
    rows: visible,
    columns: shown,
    ctx,
    scholarships,
    view,
    onChange: updateEntry,
    onRemove: removeEntry,
    onMove: reorderRows,
    docsItems: (universityId: string) => docItems.get(universityId) ?? [],
    docsAtLimit: (universityId: string) => docs.diffOf(universityId).custom.length >= MAX_CUSTOM_DOCS,
    onDocToggle: docs.toggle,
    onDocAdd: docs.add,
    onDocRemove: docs.remove,
  };

  const saving = saveState === 'saving' || docs.saveState === 'saving';
  const failed = saveState === 'error' || docs.saveState === 'error';

  return (
    <div className="w-full min-w-0">
      {!isSignedIn && (
        <div className="mb-5 border-l-4 border-l-gold border-y border-r border-border bg-gold-light/30 rounded-r-xl px-5 py-4 text-[15px] leading-relaxed text-foreground">
          {t('guest_banner')}{' '}
          <Link
            href={`/${locale}/auth/signin?next=/${locale}/compare`}
            className="font-semibold text-primary hover:text-primary/80 underline underline-offset-4 decoration-2"
          >
            {t('guest_banner_cta')}
          </Link>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
        <div className="flex-1 min-w-0">
          <Select
            value=""
            onChange={addEntry}
            options={addOptions}
            searchable
            aria-label={t('add_label')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowColumns((v) => !v)}
            aria-expanded={showColumns}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-lg text-[15px] font-semibold bg-card border border-input text-foreground hover:border-primary hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 whitespace-nowrap"
          >
            <Columns3 size={16} aria-hidden="true" />
            {t('columns_button')}
          </button>

          <button
            type="button"
            onClick={() => handleExport('xlsx')}
            disabled={visible.length === 0}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-lg text-[15px] font-semibold bg-card border border-input text-foreground hover:border-primary hover:text-primary disabled:opacity-40 disabled:hover:border-input disabled:hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 whitespace-nowrap"
          >
            <Download size={16} aria-hidden="true" />
            {t('export_xlsx')}
          </button>

          <button
            type="button"
            onClick={() => handleExport('csv')}
            disabled={visible.length === 0}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-lg text-[15px] font-semibold bg-card border border-input text-foreground hover:border-primary hover:text-primary disabled:opacity-40 disabled:hover:border-input disabled:hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 whitespace-nowrap"
          >
            <Download size={16} aria-hidden="true" />
            {t('export_csv')}
          </button>
        </div>
      </div>

      {showColumns && (
        <ColumnManager
          columns={columns}
          t={t}
          onChange={updateColumns}
          onClose={() => setShowColumns(false)}
        />
      )}

      {rows.length > 0 && (
        <ListToolbar
          t={t}
          filters={filters}
          view={view}
          countries={countries}
          shown={visible.length}
          total={rows.length}
          onFilters={setFilters}
          onView={updateView}
        />
      )}

      {limitReached && (
        <p className="text-[15px] font-medium text-crimson mb-3">{t('limit_reached', { max: 50 })}</p>
      )}
      {exportError && <p className="text-[15px] font-medium text-crimson mb-3">{t('export_failed')}</p>}
      {failed && <p className="text-[15px] font-medium text-crimson mb-3">{t('save_failed')}</p>}

      {rows.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-16 px-6 text-center bg-card/50">
          <p className="text-[17px] text-muted-foreground">{t('empty')}</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="border border-dashed border-border rounded-xl py-16 px-6 text-center bg-card/50">
          <p className="text-[17px] text-muted-foreground mb-4">{t('no_matches')}</p>
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[15px] font-semibold bg-card border border-input text-foreground hover:border-primary hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {t('filters_clear_all')}
          </button>
        </div>
      ) : (
        <>
          <div className="hidden lg:block min-w-0">
            <ListTable {...sharedProps} onSort={handleSort} />
          </div>
          <div className="lg:hidden min-w-0">
            <ListCards {...sharedProps} />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-muted-foreground border-t border-border pt-4">
            <span className="font-semibold text-foreground tabular-nums">
              {t('summary_count', { count: visible.length })}
            </span>
            <span>{t('summary_tiers', summary.tiers)}</span>
            <span className="tabular-nums">{t('summary_total', { total: moneyText(summary.totalUsd) })}</span>
            {summary.overBudget > 0 && (
              <span className="font-semibold text-crimson tabular-nums">
                {t('summary_over_budget', { count: summary.overBudget })}
              </span>
            )}
            {saving && <span>{t('saving')}</span>}
            {!saving && (saveState === 'saved' || docs.saveState === 'saved') && <span>{t('saved')}</span>}
          </div>
        </>
      )}
    </div>
  );
}
