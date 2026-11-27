/**
 * Numbers, money and dates for the page language, through Intl.
 * Costs show USD with TMT beside it, using the rate and its date from `settings`.
 */
import type { Lang } from '../i18n/config.ts';

export interface UsdTmtRate {
  /** TMT for 1 USD. */
  rate: number;
  /** `YYYY-MM-DD` the rate was set for. */
  date: string;
}

export function formatNumber(lang: Lang, value: number): string {
  return new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(value);
}

export function formatUsd(lang: Lang, usd: number): string {
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(usd);
}

/** TMT for a USD amount, rounded to whole manat. Null without a valid rate. */
export function usdToTmt(usd: number, rate: UsdTmtRate | null): number | null {
  if (!rate || !Number.isFinite(rate.rate) || rate.rate <= 0) return null;
  return Math.round(usd * rate.rate);
}

export function formatTmt(lang: Lang, tmt: number): string {
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency: 'TMT',
    maximumFractionDigits: 0,
  }).format(tmt);
}

/** `YYYY-MM-DD` as a date in the page language, e.g. "20 dek 2026". */
export function formatDate(lang: Lang, iso: string): string {
  // Noon UTC keeps the calendar day the same in every time zone.
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));
}

/** Month name (1–12) in the page language, for intakes. */
export function formatMonth(lang: Lang, month: number): string {
  return new Intl.DateTimeFormat(lang, { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2000, month - 1, 15)),
  );
}

/** A teaching language code ("en") as a name in the page language ("iňlis dili"). */
export function languageName(lang: Lang, code: string): string {
  try {
    return new Intl.DisplayNames(lang, { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The next intake month after `today`: the soonest month still ahead this year, else next year's first. */
export function nextIntake(intakes: readonly number[], today: string): number | null {
  const valid = [...new Set(intakes)].filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
  if (valid.length === 0) return null;
  valid.sort((a, b) => a - b);
  const month = Number(today.slice(5, 7));
  return valid.find((m) => m > month) ?? valid[0] ?? null;
}
