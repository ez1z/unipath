/**
 * Text for tracker screens (My Clav, item page, parent page): stage names,
 * "4 of 7 done", deadline lines. Only combines translations with data.
 */
import type { Lang, MessageKey, Translate } from '../i18n';
import { TRACKER_STAGES, type TrackerStage } from './db/values.ts';
import { deadlineText } from './view.ts';
import { BOARD_COLUMNS, daysLeft, type TrackerItemView } from './tracker.ts';

export function stageLabel(t: Translate, stage: TrackerStage): string {
  return t(`stage.${stage}` as MessageKey);
}

export function stageLabels(t: Translate): Record<TrackerStage, string> {
  return Object.fromEntries(TRACKER_STAGES.map((s) => [s, stageLabel(t, s)])) as Record<
    TrackerStage,
    string
  >;
}

export function columnLabel(t: Translate, key: (typeof BOARD_COLUMNS)[number]['key']): string {
  return t(`board.${key}` as MessageKey);
}

export function progressText(t: Translate, item: { done: number; total: number }): string {
  return t('tracker.progress', { done: item.done, total: item.total });
}

export function itemDeadlineText(
  t: Translate,
  lang: Lang,
  item: TrackerItemView,
  today: string,
): string {
  if (item.deadline === null)
    return item.rolling ? t('deadline.rolling') : t('deadline.notConfirmed');
  return deadlineText(t, lang, { deadline: item.deadline, daysLeft: daysLeft(item, today) });
}

/** "Deadline: 20 Dec 2026 · in 19 days" for a card. */
export function cardDeadline(t: Translate, lang: Lang, item: TrackerItemView, today: string) {
  return `${t('tracker.deadline')}: ${itemDeadlineText(t, lang, item, today)}`;
}
