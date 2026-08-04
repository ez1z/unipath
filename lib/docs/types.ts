import { z } from 'zod';

export const MAX_CUSTOM_DOCS = 20;
export const MAX_DOC_NAME_LENGTH = 120;

/**
 * The six documents almost every application asks for, used when a university
 * has not published its own list.
 *
 * These are i18n keys rather than names on purpose: the stable id derived from
 * one has to survive the student switching locale, and a translated name does
 * not.
 */
export const DEFAULT_DOC_KEYS = [
  'default_passport',
  'default_transcript',
  'default_recommendation_letters',
  'default_toefl',
  'default_sat',
  'default_visa_documents',
] as const;

/**
 * What the student changed about a university's document list — never the list
 * itself.
 *
 * Storing the difference rather than the resolved items is what lets a guest
 * keep a checklist in localStorage: a resolved list needs server-minted row ids
 * to be addressable, while a diff is addressable by ids the browser can derive
 * on its own. It also means a university adding a requirement later reaches
 * every student who has not already touched that item.
 */
export type DocsDiff = {
  /** Ids of ticked items — template and custom alike, so tickedness has one home. */
  checked: string[];
  /** Template ids the student deleted. Custom items are dropped outright instead. */
  removed: string[];
  /** Items the student added, in display order. */
  custom: { id: string; name: string }[];
};

export type DocItem = {
  id: string;
  name: string;
  checked: boolean;
  source: 'template' | 'custom';
};

export const EMPTY_DIFF: DocsDiff = { checked: [], removed: [], custom: [] };

const DocIdSchema = z.string().min(1).max(MAX_DOC_NAME_LENGTH + 8);

export const DocsDiffSchema = z.object({
  checked: z.array(DocIdSchema).max(MAX_CUSTOM_DOCS + 64).default([]),
  removed: z.array(DocIdSchema).max(64).default([]),
  custom: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        name: z.string().min(1).max(MAX_DOC_NAME_LENGTH),
      }),
    )
    .max(MAX_CUSTOM_DOCS)
    .default([]),
});

/** Keyed by university id. The shape both the guest store and the DB round-trip. */
export const DocsDiffMapSchema = z.record(z.string().uuid(), DocsDiffSchema);

export type DocsDiffMap = Record<string, DocsDiff>;

export function isEmptyDiff(diff: DocsDiff): boolean {
  return diff.checked.length === 0 && diff.removed.length === 0 && diff.custom.length === 0;
}
