'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import type { ColumnDef, ListEntry } from '@/lib/data/list-types';
import type { Scholarship } from '@/lib/data/scholarship-types';
import { columnLabel, universityName, type ListRow, type RowContext } from '@/lib/list/row-view';
import type { ListView } from '@/lib/list/view';
import type { DocItem } from '@/lib/docs/types';
import { DocsChecklist } from '@/components/docs/DocsChecklist';
import { Cell } from './cells';

type Props = {
  rows: ListRow[];
  columns: ColumnDef[];
  ctx: RowContext;
  scholarships: Scholarship[];
  view: ListView;
  onChange: (universityId: string, patch: Partial<ListEntry>) => void;
  onRemove: (universityId: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  docsItems: (universityId: string) => DocItem[];
  docsAtLimit: (universityId: string) => boolean;
  onDocToggle: (universityId: string, itemId: string, checked: boolean) => void;
  onDocAdd: (universityId: string, name: string) => void;
  onDocRemove: (universityId: string, itemId: string) => void;
};

// 44px minimum touch target — these are the primary reorder/remove controls on a phone.
const iconBtnCls =
  'w-11 h-11 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary active:scale-95 disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/30';

/**
 * The same rows as the table, stacked.
 *
 * A wide grid is unusable on a phone and this platform is mobile-first, so the
 * card is the primary layout rather than a fallback: the identity column
 * becomes the card heading and every other column becomes a labelled field.
 */
export function ListCards({
  rows,
  columns,
  ctx,
  scholarships,
  view,
  onChange,
  onRemove,
  onMove,
  docsItems,
  docsAtLimit,
  onDocToggle,
  onDocAdd,
  onDocRemove,
}: Props) {
  const { t, locale } = ctx;
  const [identity, ...fields] = columns;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const sorting = view.sort !== null;

  function toggleExpanded(universityId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(universityId)) next.delete(universityId);
      else next.add(universityId);
      return next;
    });
  }

  return (
    <ul className="space-y-4">
      {rows.map((row, index) => {
        const universityId = row.entry.university_id;
        const name = universityName(row.university, locale);
        const isExpanded = expanded.has(universityId);
        return (
          <li
            key={universityId}
            className="bg-card border border-border rounded-xl p-5 shadow-card"
          >
            <div className="flex items-start justify-between gap-2 pb-4 mb-4 border-b border-border">
              <Cell
                column={identity}
                row={row}
                ctx={ctx}
                scholarships={scholarships}
                onChange={(patch) => onChange(universityId, patch)}
              />
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onMove(index, index - 1)}
                  disabled={sorting || index === 0}
                  aria-label={t('move_up', { name })}
                  className={iconBtnCls}
                >
                  <ChevronUp size={20} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(index, index + 1)}
                  disabled={sorting || index === rows.length - 1}
                  aria-label={t('move_down', { name })}
                  className={iconBtnCls}
                >
                  <ChevronDown size={20} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(universityId)}
                  aria-label={t('remove_label', { name })}
                  className={iconBtnCls}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
              {fields.map((column) => (
                <div
                  key={column.id}
                  className={column.id === 'notes' || column.id === 'flags' ? 'col-span-2' : ''}
                >
                  <dt className="text-[10px] font-bold text-brand-dark/60 uppercase tracking-[0.12em] mb-2">
                    {columnLabel(column, t)}
                  </dt>
                  <dd>
                    <Cell
                      column={column}
                      row={row}
                      ctx={ctx}
                      scholarships={scholarships}
                      onChange={(patch) => onChange(universityId, patch)}
                      onToggleDocs={
                        column.kind === 'fixed' && column.id === 'docs'
                          ? () => toggleExpanded(universityId)
                          : undefined
                      }
                      docsExpanded={isExpanded}
                    />
                  </dd>
                </div>
              ))}
            </dl>

            {/* A card has no horizontal scroll, so the drawer is a plain inline
                expansion — none of the table's sticky machinery is needed. */}
            {isExpanded && (
              <div id={`docs-${universityId}`} className="mt-5 pt-5 border-t border-border">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-dark/60 mb-3">
                  {t('docs_drawer_title', { name })}
                </h3>
                <DocsChecklist
                  items={docsItems(universityId)}
                  atLimit={docsAtLimit(universityId)}
                  onToggle={(itemId, checked) => onDocToggle(universityId, itemId, checked)}
                  onAdd={(docName) => onDocAdd(universityId, docName)}
                  onRemove={(itemId) => onDocRemove(universityId, itemId)}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
