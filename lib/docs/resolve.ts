import {
  DEFAULT_DOC_KEYS,
  MAX_CUSTOM_DOCS,
  MAX_DOC_NAME_LENGTH,
  type DocItem,
  type DocsDiff,
} from './types';

/** Minimal shape of next-intl's `t`, so this stays callable from plain functions. */
export type Translate = (key: string) => string;

const MAX_TEMPLATE_ITEMS = 64;

/**
 * The documents a university asks for, before the student has touched anything.
 *
 * Ids are locale-independent by construction. Built-ins key off the i18n key, so
 * a student switching from Turkmen to Russian keeps every tick. University-
 * supplied requirements key off the requirement's own text, which is stable
 * under reordering — an admin *rewriting* a requirement resets its tick, which
 * is the right answer, because it is a different requirement now.
 */
export function templateItems(
  entranceRequirements: Record<string, unknown> | null | undefined,
  t: Translate,
): { id: string; name: string }[] {
  const raw = entranceRequirements?.document_requirements;

  if (Array.isArray(raw)) {
    const seen = new Set<string>();
    const items: { id: string; name: string }[] = [];

    for (const value of raw) {
      if (typeof value !== 'string') continue;
      const name = value.trim().slice(0, MAX_DOC_NAME_LENGTH);
      if (!name) continue;

      const id = `t:${name}`;
      if (seen.has(id)) continue;
      seen.add(id);
      items.push({ id, name });

      if (items.length >= MAX_TEMPLATE_ITEMS) break;
    }

    if (items.length > 0) return items;
  }

  return DEFAULT_DOC_KEYS.map((key) => ({ id: `d:${key}`, name: t(key) }));
}

/**
 * The checklist the student actually sees: the template, minus what they
 * deleted, plus what they added.
 *
 * Every surface calls this — the list drawer, the university page, the export —
 * so there is exactly one answer to "what is on this checklist" and the two
 * pages cannot drift apart.
 */
export function resolveDocs(
  entranceRequirements: Record<string, unknown> | null | undefined,
  diff: DocsDiff,
  t: Translate,
): DocItem[] {
  const checked = new Set(diff.checked);
  const removed = new Set(diff.removed);

  const items: DocItem[] = templateItems(entranceRequirements, t)
    .filter((item) => !removed.has(item.id))
    .map((item) => ({ ...item, checked: checked.has(item.id), source: 'template' as const }));

  for (const item of diff.custom) {
    items.push({ ...item, checked: checked.has(item.id), source: 'custom' });
  }

  return items;
}

export function docsProgress(items: DocItem[]): { total: number; checked: number } {
  return { total: items.length, checked: items.filter((i) => i.checked).length };
}

/* ------------------------------------------------------------------ *
 * Mutations — pure transforms of the diff, never of the resolved list
 * ------------------------------------------------------------------ */

export function toggleDoc(diff: DocsDiff, id: string, next: boolean): DocsDiff {
  const already = diff.checked.includes(id);
  if (already === next) return diff;

  return {
    ...diff,
    checked: next ? [...diff.checked, id] : diff.checked.filter((c) => c !== id),
  };
}

export function addDoc(diff: DocsDiff, name: string): DocsDiff {
  const trimmed = name.trim().slice(0, MAX_DOC_NAME_LENGTH);
  if (!trimmed || diff.custom.length >= MAX_CUSTOM_DOCS) return diff;

  return { ...diff, custom: [...diff.custom, { id: `c:${newDocId()}`, name: trimmed }] };
}

/**
 * Deleting a template item records the deletion; deleting a custom item drops
 * it. Either way the id stops being checked, so a re-added item never comes
 * back pre-ticked.
 */
export function removeDoc(diff: DocsDiff, id: string): DocsDiff {
  const checked = diff.checked.filter((c) => c !== id);

  if (id.startsWith('c:')) {
    return { ...diff, checked, custom: diff.custom.filter((c) => c.id !== id) };
  }

  return {
    ...diff,
    checked,
    removed: diff.removed.includes(id) ? diff.removed : [...diff.removed, id],
  };
}

function newDocId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  // Older Safari and locked-down WebViews have `crypto` without `randomUUID`.
  // Custom ids only have to be unique within one university's diff, so a
  // timestamp plus randomness is sufficient here.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
