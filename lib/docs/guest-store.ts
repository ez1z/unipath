import { DocsDiffSchema, isEmptyDiff, type DocsDiff, type DocsDiffMap } from './types';

export const GUEST_DOCS_KEY = 'unipath:docs:v1';

/* ------------------------------------------------------------------ *
 * Pure logic — no browser APIs, so it is testable in a node environment
 * ------------------------------------------------------------------ */

/**
 * One bad university's diff should not cost the student the other forty-nine,
 * so entries are validated one at a time and the unparseable ones dropped —
 * the same tolerance `normalizeColumns()` shows for stored column layouts.
 */
export function parseGuestDocs(raw: string | null): DocsDiffMap {
  if (!raw) return {};

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return {};
  }

  if (typeof json !== 'object' || json === null || Array.isArray(json)) return {};

  const out: DocsDiffMap = {};
  for (const [universityId, value] of Object.entries(json as Record<string, unknown>)) {
    const parsed = DocsDiffSchema.safeParse(value);
    if (parsed.success && !isEmptyDiff(parsed.data)) out[universityId] = parsed.data;
  }
  return out;
}

/**
 * Fold a guest's local document progress into the account they just signed in
 * to.
 *
 * Same rule as `mergeLists`: the account is authoritative, so a university the
 * server already knows about keeps its server diff, and only universities the
 * account has never seen are adopted. A merge that can add but never overwrite.
 */
export function mergeDocs(local: DocsDiffMap, server: DocsDiffMap): DocsDiffMap {
  const merged: DocsDiffMap = { ...server };
  for (const [universityId, diff] of Object.entries(local)) {
    // An empty server diff means the account has made no changes to that
    // university, so adopting the guest's copy overwrites nothing. Treating it
    // as present would block adoption for any university the caller passed in
    // pre-seeded — which is exactly what a single-university page does.
    const existing = merged[universityId];
    if (!existing || isEmptyDiff(existing)) merged[universityId] = diff;
  }
  return merged;
}

export function hasLocalDocs(docs: DocsDiffMap): boolean {
  return Object.keys(docs).length > 0;
}

/* ------------------------------------------------------------------ *
 * localStorage wrapper
 * ------------------------------------------------------------------ */

export function readGuestDocs(): DocsDiffMap {
  if (typeof window === 'undefined') return {};
  try {
    return parseGuestDocs(window.localStorage.getItem(GUEST_DOCS_KEY));
  } catch {
    // Private mode and blocked-storage settings throw on access rather than
    // returning null; an empty checklist beats a broken page.
    return {};
  }
}

export function writeGuestDocs(docs: DocsDiffMap): void {
  if (typeof window === 'undefined') return;
  try {
    // Empty diffs carry no information and would otherwise accumulate one key
    // per university the student merely glanced at.
    const payload: DocsDiffMap = {};
    for (const [universityId, diff] of Object.entries(docs)) {
      if (!isEmptyDiff(diff)) payload[universityId] = DocsDiffSchema.parse(diff) as DocsDiff;
    }
    window.localStorage.setItem(GUEST_DOCS_KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable or quota exceeded — the in-memory checklist still works */
  }
}

export function clearGuestDocs(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GUEST_DOCS_KEY);
  } catch {
    /* nothing to do */
  }
}
