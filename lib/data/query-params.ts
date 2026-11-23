/**
 * Reads a numeric filter param (e.g. `minAmount`, `maxTuition`) from the URL.
 * Returns the raw string when it is a finite number >= 0, so the input shows
 * exactly what was shared; anything else (missing, blank, malformed, negative,
 * Infinity) becomes '' so a hand-edited link can't put the list into a broken
 * state such as filtering everything out with NaN.
 */
export function parseNonNegativeNumberParam(value: string | null): string {
  if (!value || value.trim() === '') return '';
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? value : '';
}
