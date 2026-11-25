// "Show more" paging for the university list. The list renders only the first
// LIST_PAGE_SIZE results and grows by one page per click. The visible count is
// kept in the URL as `show=<n>` (only above the default) so a card's back link
// and the browser's Back button return to the same depth.

export const LIST_PAGE_SIZE = 24;

/** Ignore absurd `show` values from hand-edited URLs. */
const MAX_SHOW_PARAM = 10_000;

/** Rounds up to a whole number of pages, never below one page. */
function toWholePages(n: number): number {
  return Math.max(LIST_PAGE_SIZE, Math.ceil(n / LIST_PAGE_SIZE) * LIST_PAGE_SIZE);
}

/**
 * Reads the `show` query param. Anything that isn't a positive whole number
 * gives the default; other values round up to a whole page (show=30 → 48),
 * so "Show more" always adds full pages.
 */
export function parseShowParam(raw: string | null | undefined): number {
  if (!raw || !/^\d+$/.test(raw.trim())) return LIST_PAGE_SIZE;
  const n = Number(raw.trim());
  if (n <= 0) return LIST_PAGE_SIZE;
  return toWholePages(Math.min(n, MAX_SHOW_PARAM));
}

/**
 * Limits a visible count to what the results can fill: at most the pages
 * needed to show all `total` results, at least one page.
 */
export function clampShowCount(count: number, total: number): number {
  return Math.min(toWholePages(count), toWholePages(total));
}

/** The visible count after one more "Show more" click. */
export function nextShowCount(count: number, total: number): number {
  return clampShowCount(count + LIST_PAGE_SIZE, total);
}

/** The `show` value to put in the URL, or null when it's the default. */
export function showParamValue(count: number): string | null {
  return count > LIST_PAGE_SIZE ? String(count) : null;
}
