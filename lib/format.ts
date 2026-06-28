import { TMT_PER_USD, UNOFFICIAL_TMT_PER_USD, TRANSFER_CAP_USD, OLD_MANAT_MULTIPLIER } from '@/lib/constants';

const EN_DASH = '–';

export function formatUsd(usd: number): string {
  return `$${usd.toLocaleString('en')}`;
}

export function formatTmt(tmt: number): string {
  return `${tmt.toLocaleString('ru')} TMT`;
}

/**
 * Render a value or a range. When `max` is null/undefined or not greater than
 * `min`, only the single formatted `min` is returned; otherwise `min – max`.
 */
export function formatRange(min: number, max: number | null | undefined, fmt: (n: number) => string): string {
  if (max == null || max <= min) return fmt(min);
  return `${fmt(min)} ${EN_DASH} ${fmt(max)}`;
}

/** A single acceptance-rate percentage, e.g. "45%". Trailing-zero decimals trimmed. */
export function formatPercent(value: number): string {
  return `${Number(value.toFixed(1))}%`;
}

/** Range-aware acceptance rate: "45%" or "40 – 55%". */
export function formatPercentRange(min: number, max: number | null | undefined): string {
  if (max == null || max <= min) return formatPercent(min);
  return `${Number(min.toFixed(1))} ${EN_DASH} ${formatPercent(max)}`;
}

export function formatTuition(usd: number): string {
  return `${formatUsd(usd)} / ${formatTmt(usd * TMT_PER_USD)}`;
}

/** Range-aware tuition/amount: "$5,000 – $8,000 / 17,550 – 28,080 TMT". */
export function formatTuitionRange(min: number, max: number | null | undefined): string {
  const usd = formatRange(min, max, formatUsd);
  const tmt = formatRange(min * TMT_PER_USD, max != null ? max * TMT_PER_USD : null, formatTmt);
  return `${usd} / ${tmt}`;
}

export function computeTuitionBreakdown(tuitionUsd: number) {
  const exceedsCap = tuitionUsd > TRANSFER_CAP_USD;
  const officialTmt = Math.min(tuitionUsd, TRANSFER_CAP_USD) * TMT_PER_USD;
  const overageUsd = exceedsCap ? tuitionUsd - TRANSFER_CAP_USD : 0;
  const unofficialTmt = overageUsd * UNOFFICIAL_TMT_PER_USD;
  const totalTmt = officialTmt + unofficialTmt;
  const oldManat = Math.round(totalTmt * OLD_MANAT_MULTIPLIER);
  return {
    exceedsCap,
    officialTmt,
    overageUsd,
    unofficialTmt,
    totalTmt,
    billions: Math.floor(oldManat / 1_000_000_000),
    millions: Math.floor((oldManat % 1_000_000_000) / 1_000_000),
    thousands: Math.floor((oldManat % 1_000_000) / 1_000),
  };
}

type OldManatWords = { billion: string; million: string; thousand: string };

/** Build the spelled-out old-manat figure from a breakdown, e.g. "2 milliard 5 million". */
export function formatOldManat(
  bd: ReturnType<typeof computeTuitionBreakdown>,
  words: OldManatWords,
): string {
  const parts: string[] = [];
  if (bd.billions > 0) parts.push(`${bd.billions} ${words.billion}`);
  if (bd.millions > 0) parts.push(`${bd.millions} ${words.million}`);
  if (bd.thousands > 0) parts.push(`${bd.thousands} ${words.thousand}`);
  return parts.join(' ') || `< 1 ${words.thousand}`;
}

/** Range-aware old-manat text: collapses to a single value when min/max coincide. */
export function formatOldManatRange(
  bdMin: ReturnType<typeof computeTuitionBreakdown>,
  bdMax: ReturnType<typeof computeTuitionBreakdown> | null,
  words: OldManatWords,
): string {
  const minText = formatOldManat(bdMin, words);
  if (!bdMax) return minText;
  const maxText = formatOldManat(bdMax, words);
  return minText === maxText ? minText : `${minText} ${EN_DASH} ${maxText}`;
}

export function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}
