'use client';

import Link from 'next/link';
import { Check, X } from 'lucide-react';
import type { ColumnDef, ListEntry, Status, Tier } from '@/lib/data/list-types';
import { STATUSES, TIERS } from '@/lib/data/list-types';
import type { Scholarship } from '@/lib/data/scholarship-types';
import { deadlineBadgeCls, semesterKey, type ResolvedDeadline } from '@/lib/data/deadline';
import { formatDate, formatPercentRange } from '@/lib/format';
import { Select, type SelectTone } from '@/components/ui/Select';
import {
  cellText,
  flagText,
  usdText,
  tmtText,
  universityName,
  type ListRow,
  type RowContext,
} from '@/lib/list/row-view';

const EDITABLE_FIXED = new Set(['tier', 'status', 'scholarships', 'notes']);

export function isEditable(column: ColumnDef): boolean {
  return column.kind === 'custom' || EDITABLE_FIXED.has(column.id);
}

/**
 * Tier is a category and status is a position in a sequence, so they are given
 * different visual grammar: tier tints its whole control, status carries a dot.
 * Colours come from the platform palette — crimson reaches, gold aims, green is safe.
 */
const TIER_TONE: Record<Tier, SelectTone> = {
  dream: 'crimson',
  target: 'gold',
  safety: 'green',
};

const STATUS_TONE: Record<Status, SelectTone> = {
  planning: 'muted',
  applying: 'gold',
  applied: 'primary',
  accepted: 'green',
  rejected: 'crimson',
};

const inputCls =
  'w-full bg-card border border-input rounded-lg px-3 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

/**
 * A semester the student has chosen may not have a published deadline yet —
 * targeting "Spring 2027" before its date is announced is normal — so this
 * renders a countdown badge or the bare semester name, never a broken date.
 */
function DeadlineBadge({
  resolved,
  t,
}: {
  resolved: ResolvedDeadline;
  t: RowContext['t'];
}) {
  const { semester, days } = resolved;

  if (days == null || !semester.deadline) {
    return (
      <span className="inline-block text-[14px] text-muted-foreground whitespace-nowrap">
        {t('semester_no_deadline')}
      </span>
    );
  }

  return (
    <span
      className={`inline-block text-[14px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap tabular-nums ${deadlineBadgeCls(days)}`}
    >
      {formatDate(new Date(semester.deadline))}
    </span>
  );
}

type CellProps = {
  column: ColumnDef;
  row: ListRow;
  ctx: RowContext;
  scholarships: Scholarship[];
  onChange: (patch: Partial<ListEntry>) => void;
  /** Absent in read-only contexts; its presence is what makes the docs cell a button. */
  onToggleDocs?: () => void;
  docsExpanded?: boolean;
};

export function Cell({
  column,
  row,
  ctx,
  scholarships,
  onChange,
  onToggleDocs,
  docsExpanded = false,
}: CellProps) {
  const { t, locale } = ctx;
  const uni = row.university;
  const name = universityName(uni, locale);

  if (column.kind === 'custom') {
    const value = row.entry.custom[column.id];
    const label = t('custom_value_label', { column: column.name, name });

    if (column.type === 'checkbox') {
      const checked = value === true;
      return (
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange({ custom: { ...row.entry.custom, [column.id]: !checked } })}
          className={`w-7 h-7 rounded-md border-2 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
            checked
              ? 'bg-tk-green border-tk-green text-white'
              : 'bg-card border-input hover:border-primary/50'
          }`}
        >
          {checked && <Check size={16} strokeWidth={3} aria-hidden="true" />}
        </button>
      );
    }

    return (
      <input
        type={column.type === 'number' ? 'number' : 'text'}
        inputMode={column.type === 'number' ? 'decimal' : undefined}
        value={value == null ? '' : String(value)}
        aria-label={label}
        maxLength={200}
        onChange={(e) => {
          const raw = e.target.value;
          const next = column.type === 'number' && raw !== '' ? Number(raw) : raw;
          onChange({ custom: { ...row.entry.custom, [column.id]: next } });
        }}
        className={`${inputCls} min-w-[8rem] ${column.type === 'number' ? 'tabular-nums' : ''}`}
      />
    );
  }

  switch (column.id) {
    case 'university':
      return (
        <div className="min-w-[12rem]">
          <Link
            href={`/${locale}/universities/${uni.slug}`}
            aria-label={t('view_university', { name })}
            className="font-heading font-semibold text-[16px] leading-snug text-foreground hover:text-primary transition-colors"
          >
            {name}
          </Link>
          <span className="block text-[13px] text-muted-foreground mt-1">
            {uni.city}, {uni.country}
          </span>
        </div>
      );

    case 'tier': {
      const suggested = row.fit.tier;
      return (
        <div className="min-w-[8.5rem]">
          <Select
            value={row.entry.tier ?? ''}
            onChange={(v) => onChange({ tier: (v || null) as Tier | null })}
            aria-label={t('tier_label', { name })}
            portal
            tinted
            options={[
              { value: '', label: t('tier_unset'), muted: true },
              ...TIERS.map((tier) => ({
                value: tier,
                label: t(`tier_${tier}`),
                tone: TIER_TONE[tier],
              })),
            ]}
          />
          {suggested && !row.entry.tier && (
            <span className="block text-[12px] text-muted-foreground mt-1.5 leading-tight">
              {t('tier_suggested', { tier: t(`tier_${suggested}`) })}
            </span>
          )}
        </div>
      );
    }

    case 'status':
      return (
        <div className="min-w-[9.5rem]">
          <Select
            value={row.entry.status}
            onChange={(v) => onChange({ status: v as Status })}
            aria-label={t('status_label', { name })}
            portal
            options={STATUSES.map((status) => ({
              value: status,
              label: t(`status_${status}`),
              tone: STATUS_TONE[status],
            }))}
          />
        </div>
      );

    case 'scholarships': {
      const linked = row.entry.scholarship_ids;
      const relevant = scholarships.filter(
        (s) =>
          !linked.includes(s.id) &&
          (s.university_id === uni.id ||
            (s.university_id === null && s.country === uni.country)),
      );
      return (
        <div className="min-w-[13rem] space-y-2">
          {linked.map((id) => {
            const s = scholarships.find((x) => x.id === id);
            if (!s) return null;
            const sName = s.name[locale] ?? s.name.en;
            return (
              <span
                key={id}
                className="flex items-center gap-1.5 bg-gold-light/50 border border-gold/40 rounded-lg pl-3 pr-1.5 py-1.5 text-[14px] font-medium text-gold-dark"
              >
                <span className="truncate">{sName}</span>
                <button
                  type="button"
                  aria-label={t('remove_label', { name: sName })}
                  onClick={() => onChange({ scholarship_ids: linked.filter((x) => x !== id) })}
                  className="ml-auto p-1 rounded-md text-gold-dark/60 hover:text-gold-dark hover:bg-gold/20 transition-colors"
                >
                  <X size={14} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </span>
            );
          })}
          {relevant.length > 0 && (
            <Select
              value=""
              onChange={(v) => v && onChange({ scholarship_ids: [...linked, v] })}
              aria-label={t('scholarship_label', { name })}
              portal
              size="sm"
              options={[
                { value: '', label: t('scholarship_add'), muted: true },
                ...relevant.map((s) => ({
                  value: s.id,
                  label: s.name[locale] ?? s.name.en,
                })),
              ]}
            />
          )}
          {linked.length === 0 && relevant.length === 0 && (
            <span className="text-[14px] text-muted-foreground">{t('scholarships_none')}</span>
          )}
        </div>
      );
    }

    case 'notes':
      return (
        <textarea
          value={row.entry.notes ?? ''}
          aria-label={t('notes_label', { name })}
          placeholder={t('notes_placeholder')}
          rows={2}
          maxLength={2000}
          onChange={(e) => onChange({ notes: e.target.value || null })}
          className={`${inputCls} min-w-[12rem] resize-y leading-relaxed`}
        />
      );

    case 'deadline': {
      const semesters = uni.semesters ?? [];

      // With one intake there is nothing to choose between, and a dropdown
      // holding a single option is noise on an already-wide table.
      if (semesters.length < 2) {
        return row.deadline ? (
          <DeadlineBadge resolved={row.deadline} t={t} />
        ) : (
          <span className="text-[15px] text-muted-foreground">{t('none')}</span>
        );
      }

      return (
        <div className="min-w-[11rem] space-y-2">
          <Select
            value={row.entry.semester_key ?? ''}
            onChange={(v) => onChange({ semester_key: v || null })}
            aria-label={t('semester_label', { name })}
            portal
            size="sm"
            options={[
              { value: '', label: t('semester_auto'), muted: true },
              ...semesters.map((s) => ({
                value: semesterKey(s),
                label: s.deadline
                  ? `${s.name} · ${formatDate(new Date(s.deadline))}`
                  : `${s.name} — ${t('semester_no_deadline')}`,
              })),
            ]}
          />
          {row.deadline && <DeadlineBadge resolved={row.deadline} t={t} />}
        </div>
      );
    }

    // Money stacks the two currencies instead of running them together on one
    // line — a single row of "$72,722 – $95,770 / 255 254 TMT – 336 153 TMT"
    // is most of the table's width on its own.
    case 'tuition':
      return (
        <div className="min-w-[9rem] leading-tight">
          <span className="block text-[15px] font-semibold text-foreground tabular-nums">
            {usdText(uni.tuition_usd, uni.tuition_usd_max)}
          </span>
          <span className="block text-[13px] text-muted-foreground tabular-nums mt-0.5">
            {tmtText(uni.tuition_usd, uni.tuition_usd_max)}
          </span>
        </div>
      );

    case 'net_cost':
      return (
        <div className="min-w-[9rem] leading-tight">
          <span className="block text-[15px] font-semibold text-foreground tabular-nums">
            {usdText(row.netCostMinUsd, row.netCostMaxUsd)}
          </span>
          <span className="block text-[13px] text-muted-foreground tabular-nums mt-0.5">
            {tmtText(row.netCostMinUsd, row.netCostMaxUsd)}
          </span>
        </div>
      );

    case 'docs': {
      const total = row.docs?.total ?? 0;
      const checked = row.docs?.checked ?? 0;
      const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

      const bar = (
        <>
          <div
            className="bg-secondary rounded-full h-2 border border-border/60"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('col_docs')}
          >
            <div
              className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-tk-green' : 'bg-gold'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="block text-[13px] text-muted-foreground mt-1.5 tabular-nums">
            {cellText(column, row, ctx)}
          </span>
        </>
      );

      if (!onToggleDocs) return <div className="min-w-[7rem]">{bar}</div>;

      return (
        <button
          type="button"
          onClick={onToggleDocs}
          aria-expanded={docsExpanded}
          aria-controls={`docs-${row.entry.university_id}`}
          aria-label={t('docs_toggle', { name })}
          className="min-w-[7rem] w-full text-left rounded-lg px-2 py-1.5 -mx-2 hover:bg-secondary/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
        >
          {bar}
        </button>
      );
    }

    case 'moe':
      return uni.moe_approved ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-gold-light/60 text-gold-dark border border-gold/50 whitespace-nowrap">
          ★ {t('col_moe')}
        </span>
      ) : (
        <span className="text-[15px] text-muted-foreground">{t('none')}</span>
      );

    case 'ranking':
      return (
        <span className="text-[15px] font-semibold text-foreground tabular-nums whitespace-nowrap">
          {uni.ranking_qs != null ? `#${uni.ranking_qs}` : t('none')}
        </span>
      );

    case 'acceptance':
      return (
        <span className="text-[15px] text-foreground tabular-nums whitespace-nowrap">
          {uni.acceptance_rate_min != null
            ? formatPercentRange(uni.acceptance_rate_min, uni.acceptance_rate_max)
            : t('none')}
        </span>
      );

    case 'flags':
      return row.fit.flags.length === 0 ? (
        <span className="text-[14px] text-muted-foreground">{t('flags_none')}</span>
      ) : (
        <ul className="space-y-1.5 min-w-[12rem]">
          {row.fit.flags.map((flag, i) => (
            <li
              key={i}
              className="text-[13px] leading-snug text-crimson-dark border-l-2 border-crimson/40 pl-2.5"
            >
              {flagText(flag, t)}
            </li>
          ))}
        </ul>
      );

    default:
      return (
        <span className="text-[15px] text-foreground whitespace-nowrap">
          {cellText(column, row, ctx)}
        </span>
      );
  }
}
