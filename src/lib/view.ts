/**
 * Small text helpers shared by components and pages. They only combine
 * translations with formatting; no data access.
 */
import type { Lang, MessageKey, Translate } from '../i18n';
import type { Field, MinistryStatus, ProgramLevel, TriState } from './db/values.ts';
import {
  formatDate,
  formatNumber,
  formatTmt,
  formatUsd,
  usdToTmt,
  type UsdTmtRate,
} from './format.ts';
import { tkList } from './tk-intl.ts';

export function levelLabel(t: Translate, level: ProgramLevel): string {
  return t(`level.${level}` as MessageKey);
}

export function fieldLabel(t: Translate, field: Field): string {
  return t(`field.${field}` as MessageKey);
}

export function ministryLabel(t: Translate, status: MinistryStatus): string {
  return t(`ministry.${status}` as MessageKey);
}

export function yearsText(t: Translate, years: number): string {
  return t('common.years', { n: years });
}

export interface DeadlineFacts {
  deadline: string | null;
  rolling?: boolean;
  daysLeft?: number | null;
  open?: boolean;
}

/** "20 Dec 2026 · in 19 days", "Closed", "Rolling: apply any time", "Deadline not confirmed". */
export function deadlineText(t: Translate, lang: Lang, d: DeadlineFacts): string {
  if (d.rolling) return t('deadline.rolling');
  if (d.deadline === null) return t('deadline.notConfirmed');
  const date = formatDate(lang, d.deadline);
  if (d.open === false || (d.daysLeft ?? 0) < 0) return `${date} · ${t('deadline.closed')}`;
  if (d.daysLeft === 0) return `${date} · ${t('deadline.today')}`;
  if (d.daysLeft !== null && d.daysLeft !== undefined) {
    return `${date} · ${t('deadline.inDays', { n: d.daysLeft })}`;
  }
  return date;
}

export interface MoneyText {
  usd: string;
  /** "about 21 000 TMT", or null without a rate. */
  tmt: string | null;
}

export function moneyText(
  t: Translate,
  lang: Lang,
  usd: number,
  rate: UsdTmtRate | null,
): MoneyText {
  const tmt = usdToTmt(usd, rate);
  return {
    usd: formatUsd(lang, usd),
    tmt: tmt === null ? null : t('money.tmt', { amount: formatTmt(lang, tmt) }),
  };
}

export function rateNote(t: Translate, lang: Lang, rate: UsdTmtRate | null): string | null {
  if (!rate) return null;
  return t('money.rateNote', {
    rate: formatNumber(lang, rate.rate),
    date: formatDate(lang, rate.date),
  });
}

export function triStateKey(prefix: 'scholarship.preYear' | 'scholarship.turkmen', v: TriState) {
  return `${prefix}.${v}` as MessageKey;
}

/** Joins a list the way the language does: "a, b and c". */
export function listText(lang: Lang, items: string[]): string {
  if (lang === 'tk') return tkList(items);
  return new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' }).format(items);
}
