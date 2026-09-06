import type { Locale } from '@/lib/constants';
import type { University } from '@/lib/data/university-types';
import type { Scholarship } from '@/lib/data/scholarship-types';
import type { ColumnDef, ListEntry, Tier } from '@/lib/data/list-types';
import type { FitResult, FitFlag } from '@/lib/data/fit';
import { resolveSemester, type ResolvedDeadline } from '@/lib/data/deadline';
import { formatDate, formatRange, formatUsd, formatTmt, formatPercentRange } from '@/lib/format';
import { TMT_PER_USD } from '@/lib/constants';

export type DocsProgress = { total: number; checked: number };

export type ListRow = {
  entry: ListEntry;
  university: University;
  fit: FitResult;
  /** The student's chosen intake, or the nearest one when they have not chosen. */
  deadline: ResolvedDeadline | null;
  docs: DocsProgress | undefined;
  /**
   * Tuition after linked scholarships, as a range.
   *
   * Both tuition and awards are ranges, so a single figure has to pick one end
   * of each — and subtracting the largest possible award from the smallest
   * possible tuition prints "$0" for schools that can still cost $90k. The best
   * case pairs cheapest tuition with the largest award; the worst case pairs
   * dearest tuition with the smallest.
   */
  netCostMinUsd: number;
  netCostMaxUsd: number;
};

/** Minimal shape of next-intl's `t`, so this stays usable from plain functions. */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

export type RowContext = {
  locale: Locale;
  t: Translate;
  scholarshipsById: Map<string, Scholarship>;
};

export function buildRow(
  entry: ListEntry,
  university: University,
  fit: FitResult,
  docs: DocsProgress | undefined,
  scholarshipsById: Map<string, Scholarship>,
): ListRow {
  let awardMin = 0;
  let awardMax = 0;
  for (const id of entry.scholarship_ids) {
    const s = scholarshipsById.get(id);
    if (!s) continue;
    const min = s.amount_usd ?? 0;
    awardMin += min;
    awardMax += s.amount_usd_max ?? min;
  }

  const tuitionMax = university.tuition_usd_max ?? university.tuition_usd;

  return {
    entry,
    university,
    fit,
    deadline: resolveSemester(university.semesters, entry.semester_key),
    docs,
    netCostMinUsd: Math.max(0, university.tuition_usd - awardMax),
    netCostMaxUsd: Math.max(0, tuitionMax - awardMin),
  };
}

export function universityName(uni: University, locale: Locale): string {
  return uni.name[locale] ?? uni.name.en;
}

export function tierLabel(tier: Tier | null, t: Translate): string {
  return tier ? t(`tier_${tier}`) : t('tier_unset');
}

export function flagText(flag: FitFlag, t: Translate): string {
  switch (flag.code) {
    case 'test_below_min':
      return t('flag_test_below_min', {
        test: flag.test.toUpperCase(),
        yours: flag.yours,
        required: flag.required,
      });
    case 'test_required_missing':
      // Two wordings rather than one with an empty slot: a university that names
      // a test without publishing a minimum is a real and common case, and
      // "IELTS  required" with a hole in it reads as a bug.
      return flag.required != null
        ? t('flag_test_required_missing', {
            test: flag.test.toUpperCase(),
            required: flag.required,
          })
        : t('flag_test_required_missing_no_min', { test: flag.test.toUpperCase() });
    case 'over_budget':
      return t('flag_over_budget', {
        tuition: formatUsd(flag.required),
        budget: formatUsd(flag.yours),
      });
    case 'not_moe_approved':
      return t('flag_not_moe_approved');
    case 'highly_selective':
      return t('flag_highly_selective', { rate: flag.rate });
  }
}

/**
 * Whether a flag reports a problem with the application or a gap in the
 * student's own profile.
 *
 * `test_required_missing` is the second kind: nothing is known to be wrong with
 * the candidacy, we simply cannot judge it until a score exists. Painting it in
 * the same alarm colour as "below the required score" would tell a student they
 * had failed a bar they have not yet attempted — and the fix is one form field,
 * not a different university.
 */
export type FlagSeverity = 'issue' | 'action';

export function flagSeverity(flag: FitFlag): FlagSeverity {
  return flag.code === 'test_required_missing' ? 'action' : 'issue';
}

/**
 * Both currencies, per the platform rule that money is never shown in USD alone.
 *
 * Manat is rounded to whole units here: a tuition cell reading "255 254,22 TMT"
 * spends a lot of column width on precision nobody acts on.
 */
export function usdText(usd: number, maxUsd?: number | null): string {
  return formatRange(usd, maxUsd, formatUsd);
}

export function tmtText(usd: number, maxUsd?: number | null): string {
  return formatRange(
    Math.round(usd * TMT_PER_USD),
    maxUsd != null ? Math.round(maxUsd * TMT_PER_USD) : null,
    formatTmt,
  );
}

export function moneyText(usd: number, maxUsd?: number | null): string {
  return `${usdText(usd, maxUsd)} / ${tmtText(usd, maxUsd)}`;
}

export function scholarshipNames(row: ListRow, ctx: RowContext): string[] {
  return row.entry.scholarship_ids
    .map((id) => ctx.scholarshipsById.get(id))
    .filter((s): s is Scholarship => Boolean(s))
    .map((s) => s.name[ctx.locale] ?? s.name.en);
}

/**
 * The plain-text value of one cell.
 *
 * The table, the mobile cards and the spreadsheet export all read from here, so
 * a change to how a value is worded lands in all three at once — and the
 * exported file genuinely matches what the student was looking at.
 */
export function cellText(column: ColumnDef, row: ListRow, ctx: RowContext): string {
  const { t, locale } = ctx;
  const uni = row.university;

  if (column.kind === 'custom') {
    const value = row.entry.custom[column.id];
    if (value == null || value === '') return '';
    if (typeof value === 'boolean') return value ? '✓' : '';
    return String(value);
  }

  switch (column.id) {
    case 'university':
      return `${universityName(uni, locale)} — ${uni.city}, ${uni.country}`;
    case 'tier':
      return tierLabel(row.entry.tier ?? row.fit.tier, t);
    case 'status':
      return t(`status_${row.entry.status}`);
    case 'deadline': {
      // The cell is a semester picker now, so the exported value names the
      // intake as well as its date — otherwise a spreadsheet of three "Fall"
      // deadlines gives no way to tell which one the student chose.
      if (!row.deadline) return t('none');
      const { semester } = row.deadline;
      return semester.deadline
        ? `${semester.name} · ${formatDate(new Date(semester.deadline))}`
        : semester.name;
    }
    case 'tuition':
      return moneyText(uni.tuition_usd, uni.tuition_usd_max);
    case 'scholarships': {
      const names = scholarshipNames(row, ctx);
      return names.length ? names.join(', ') : t('scholarships_none');
    }
    case 'net_cost':
      return moneyText(row.netCostMinUsd, row.netCostMaxUsd);
    case 'docs':
      return row.docs && row.docs.total > 0
        ? t('docs_progress', { checked: row.docs.checked, total: row.docs.total })
        : t('docs_none');
    case 'moe':
      return uni.moe_approved ? t('col_moe') : t('none');
    case 'ranking':
      return uni.ranking_qs != null ? `#${uni.ranking_qs}` : t('none');
    case 'acceptance':
      return uni.acceptance_rate_min != null
        ? formatPercentRange(uni.acceptance_rate_min, uni.acceptance_rate_max)
        : t('none');
    case 'flags':
      return row.fit.flags.length
        ? row.fit.flags.map((f) => flagText(f, t)).join(' · ')
        : t('flags_none');
    case 'notes':
      return row.entry.notes ?? '';
  }
}

export function columnLabel(column: ColumnDef, t: Translate): string {
  return column.kind === 'custom' ? column.name : t(`col_${column.id}`);
}
