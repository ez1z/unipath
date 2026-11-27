/**
 * Date-only helpers. Dates are ISO `YYYY-MM-DD` strings, compared as text.
 * "Today" is the date in Ashgabat, so deadlines flip at midnight Turkmenistan time.
 */

export const CLAVIS_TIME_ZONE = 'Asia/Ashgabat';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** Today's date in a time zone, as `YYYY-MM-DD`. */
export function todayIn(timeZone: string = CLAVIS_TIME_ZONE, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * A scholarship is open unless its deadline has passed. Rolling scholarships and
 * ones with no confirmed deadline count as open (their deadline is shown as unknown).
 */
export function isScholarshipOpen(
  scholarship: { deadline: string | null; rolling: boolean },
  today: string,
): boolean {
  return scholarship.rolling || scholarship.deadline === null || scholarship.deadline >= today;
}
