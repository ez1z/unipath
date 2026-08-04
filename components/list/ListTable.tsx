'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronUp, ChevronDown, GripVertical, Trash2 } from 'lucide-react';
import type { ColumnDef, ListEntry } from '@/lib/data/list-types';
import type { Scholarship } from '@/lib/data/scholarship-types';
import { columnLabel, universityName, type ListRow, type RowContext } from '@/lib/list/row-view';
import { isSortable, type ListView } from '@/lib/list/view';
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
  onSort: (columnId: string) => void;
  docsItems: (universityId: string) => DocItem[];
  docsAtLimit: (universityId: string) => boolean;
  onDocToggle: (universityId: string, itemId: string, checked: boolean) => void;
  onDocAdd: (universityId: string, name: string) => void;
  onDocRemove: (universityId: string, itemId: string) => void;
};

const iconBtnCls =
  'p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-secondary disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30';

export function ListTable({
  rows,
  columns,
  ctx,
  scholarships,
  view,
  onChange,
  onRemove,
  onMove,
  onSort,
  docsItems,
  docsAtLimit,
  onDocToggle,
  onDocAdd,
  onDocRemove,
}: Props) {
  const { t, locale } = ctx;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Manual order is only meaningful when the rows are in it.
  const sorting = view.sort !== null;

  /**
   * The document drawer spans every column, so its cell is as wide as the whole
   * table — `sticky left-0` pins the cell but not its contents, and scrolling
   * right would slide the checkboxes out of view. Publishing the scroll
   * container's own width lets the drawer size itself to what the student can
   * actually see. Without a ResizeObserver the var is simply unset and the
   * drawer falls back to full width, which is the pre-existing behaviour.
   */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const publish = () => el.style.setProperty('--list-viewport', `${el.clientWidth}px`);
    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function toggleExpanded(universityId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(universityId)) next.delete(universityId);
      else next.add(universityId);
      return next;
    });
  }

  return (
    /* w-full + min-w-0 so the container is sized by its parent, never by the
       table inside it — otherwise a wide table scrolls the whole page. */
    <div
      ref={scrollRef}
      className="w-full min-w-0 overflow-x-auto [contain:paint] border border-border rounded-xl bg-card shadow-card"
    >
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-secondary/60 border-b-2 border-gold/30">
            <th scope="col" className="w-24 px-3 py-4">
              <span className="sr-only">{t('col_reorder')}</span>
            </th>
            {columns.map((column) => {
              const sortable = column.kind === 'fixed' && isSortable(column.id);
              const active = view.sort?.columnId === column.id ? view.sort : null;
              const label = columnLabel(column, t);

              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={active ? (active.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className="px-4 py-4 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-dark/70 whitespace-nowrap"
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(column.id)}
                      aria-label={t('sort_by_column', { column: label })}
                      className="inline-flex items-center gap-1.5 uppercase tracking-[0.12em] hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 rounded"
                    >
                      {label}
                      {active ? (
                        active.dir === 'asc' ? (
                          <ArrowUp size={13} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={13} aria-hidden="true" />
                        )
                      ) : (
                        /* Invisible placeholder so the header does not shift
                           sideways the moment it becomes sorted. */
                        <ArrowUp size={13} className="opacity-0" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    label
                  )}
                </th>
              );
            })}
            <th scope="col" className="w-14 px-3 py-4">
              <span className="sr-only">{t('remove')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const universityId = row.entry.university_id;
            const name = universityName(row.university, locale);
            const isExpanded = expanded.has(universityId);

            return [
              <tr
                key={universityId}
                draggable={!sorting}
                onDragStart={() => !sorting && setDragIndex(index)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (!sorting && dragIndex !== null) onMove(dragIndex, index);
                  setDragIndex(null);
                }}
                className={`border-b border-border align-top transition-colors hover:bg-secondary/30 ${
                  dragIndex === index ? 'opacity-40' : ''
                } ${isExpanded ? 'bg-secondary/20' : ''}`}
              >
                <td className="px-3 py-4">
                  <div className="flex items-center gap-0.5">
                    <GripVertical
                      size={16}
                      className={`shrink-0 ${sorting ? 'text-muted-foreground/25' : 'text-muted-foreground/60 cursor-grab'}`}
                      aria-hidden="true"
                    />
                    {/* Drag is mouse-only; these keep reordering reachable by keyboard. */}
                    <button
                      type="button"
                      onClick={() => onMove(index, index - 1)}
                      disabled={sorting || index === 0}
                      aria-label={t('move_up', { name })}
                      className={iconBtnCls}
                    >
                      <ChevronUp size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(index, index + 1)}
                      disabled={sorting || index === rows.length - 1}
                      aria-label={t('move_down', { name })}
                      className={iconBtnCls}
                    >
                      <ChevronDown size={16} aria-hidden="true" />
                    </button>
                  </div>
                </td>

                {columns.map((column) => (
                  <td key={column.id} className="px-4 py-4">
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
                  </td>
                ))}

                <td className="px-3 py-4">
                  <button
                    type="button"
                    onClick={() => onRemove(universityId)}
                    aria-label={t('remove_label', { name })}
                    className={iconBtnCls}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </td>
              </tr>,

              isExpanded ? (
                <tr key={`${universityId}-docs`} className="border-b border-border bg-secondary/20">
                  <td colSpan={columns.length + 2} className="p-0">
                    <div
                      id={`docs-${universityId}`}
                      className="sticky left-0 px-6 py-5"
                      style={{ width: 'var(--list-viewport, 100%)' }}
                    >
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-dark/70 mb-3">
                        {t('docs_drawer_title', { name })}
                      </h3>
                      <DocsChecklist
                        dense
                        items={docsItems(universityId)}
                        atLimit={docsAtLimit(universityId)}
                        onToggle={(itemId, checked) => onDocToggle(universityId, itemId, checked)}
                        onAdd={(docName) => onDocAdd(universityId, docName)}
                        onRemove={(itemId) => onDocRemove(universityId, itemId)}
                      />
                    </div>
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
