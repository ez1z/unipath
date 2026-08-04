'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, Eye, EyeOff, GripVertical, Plus, Trash2 } from 'lucide-react';
import {
  CUSTOM_COLUMN_TYPES,
  MAX_CUSTOM_COLUMNS,
  PINNED_COLUMN_ID,
  type ColumnDef,
  type CustomColumnType,
} from '@/lib/data/list-types';
import { Select } from '@/components/ui/Select';
import { columnLabel, type Translate } from '@/lib/list/row-view';

type Props = {
  columns: ColumnDef[];
  t: Translate;
  onChange: (columns: ColumnDef[]) => void;
  onClose: () => void;
};

const iconBtnCls =
  'p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-secondary disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30';

export function ColumnManager({ columns, t, onChange, onClose }: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CustomColumnType>('text');

  const customCount = columns.filter((c) => c.kind === 'custom').length;
  const atLimit = customCount >= MAX_CUSTOM_COLUMNS;

  function move(from: number, to: number) {
    if (to < 0 || to >= columns.length || from === to) return;
    const next = [...columns];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  function toggleHidden(id: string) {
    onChange(columns.map((c) => (c.id === id ? { ...c, hidden: !c.hidden } : c)));
  }

  function rename(id: string, name: string) {
    onChange(columns.map((c) => (c.id === id && c.kind === 'custom' ? { ...c, name } : c)));
  }

  function remove(id: string) {
    onChange(columns.filter((c) => c.id !== id));
  }

  function addCustom() {
    const name = newName.trim();
    if (!name || atLimit) return;
    onChange([
      ...columns,
      // Random id, not a slug of the name: renaming a column must not orphan the
      // values already stored against it in every row.
      { id: crypto.randomUUID(), kind: 'custom', name: name.slice(0, 40), type: newType },
    ]);
    setNewName('');
    setNewType('text');
  }

  return (
    <div className="border border-border rounded-xl bg-card shadow-card p-5 sm:p-6 mb-4">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="font-heading font-semibold text-xl text-foreground">
          {t('columns_title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-[15px] font-semibold text-primary hover:text-primary/80 transition-colors px-3 py-1.5 -mr-3 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {t('columns_close')}
        </button>
      </div>
      <p className="text-[15px] text-muted-foreground mb-5">{t('columns_help')}</p>

      <ul className="space-y-1 mb-6">
        {columns.map((column, index) => {
          const label = columnLabel(column, t);
          const pinned = column.id === PINNED_COLUMN_ID;
          return (
            <li
              key={column.id}
              draggable={!pinned}
              onDragStart={() => setDragIndex(index)}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              className={`flex items-center gap-2.5 py-2 px-2.5 rounded-lg border border-transparent hover:border-border hover:bg-secondary/40 transition-colors ${
                dragIndex === index ? 'opacity-50' : ''
              }`}
            >
              <GripVertical
                size={16}
                className={`shrink-0 text-muted-foreground ${pinned ? 'opacity-30' : 'cursor-grab'}`}
                aria-hidden="true"
              />

              {column.kind === 'custom' ? (
                <input
                  value={column.name}
                  onChange={(e) => rename(column.id, e.target.value)}
                  aria-label={t('column_rename', { name: label })}
                  maxLength={40}
                  className="flex-1 min-w-0 bg-card border border-input rounded-lg px-3 py-2 text-[15px] text-foreground hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
                />
              ) : (
                <span className="flex-1 min-w-0 text-[15px] text-foreground truncate">{label}</span>
              )}

              {pinned ? (
                <span className="text-[12px] text-muted-foreground whitespace-nowrap px-2">
                  {t('column_pinned')}
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={index <= 1}
                    aria-label={t('column_move_up', { name: label })}
                    className={iconBtnCls}
                  >
                    <ChevronUp size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={index === columns.length - 1}
                    aria-label={t('column_move_down', { name: label })}
                    className={iconBtnCls}
                  >
                    <ChevronDown size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleHidden(column.id)}
                    aria-label={
                      column.hidden
                        ? t('column_show', { name: label })
                        : t('column_hide', { name: label })
                    }
                    className={iconBtnCls}
                  >
                    {column.hidden ? (
                      <EyeOff size={16} aria-hidden="true" />
                    ) : (
                      <Eye size={16} aria-hidden="true" />
                    )}
                  </button>
                  {column.kind === 'custom' && (
                    <button
                      type="button"
                      onClick={() => remove(column.id)}
                      aria-label={t('column_delete', { name: label })}
                      className={iconBtnCls}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      <div className="border-t border-border pt-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
            placeholder={t('add_column_name')}
            aria-label={t('add_column_name')}
            maxLength={40}
            disabled={atLimit}
            className="flex-1 bg-card border border-input rounded-lg px-3.5 py-3 text-[15px] text-foreground placeholder:text-muted-foreground hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors disabled:opacity-50"
          />
          <div className="sm:w-40">
            <Select
              value={newType}
              onChange={(v) => setNewType(v as CustomColumnType)}
              aria-label={t('add_column_type')}
              options={CUSTOM_COLUMN_TYPES.map((type) => ({
                value: type,
                label: t(`type_${type}`),
              }))}
            />
          </div>
          <button
            type="button"
            onClick={addCustom}
            disabled={atLimit || !newName.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-[15px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <Plus size={16} aria-hidden="true" />
            {t('add_column')}
          </button>
        </div>
        {atLimit && (
          <p className="text-[13px] text-muted-foreground mt-3">
            {t('custom_limit_reached', { max: MAX_CUSTOM_COLUMNS })}
          </p>
        )}
      </div>
    </div>
  );
}
