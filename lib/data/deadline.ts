import type { Semester } from '@/lib/types/semester';

export type NearestDeadline = { semester: Semester; days: number };

/**
 * The deadline a student actually cares about: the soonest one still ahead of
 * them, or — when every deadline has passed — the most recent one, so the UI
 * can say "passed" instead of showing nothing.
 */
export function getNearestDeadline(semesters: Semester[]): NearestDeadline | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const withDeadlines = semesters
    .filter((s) => s.deadline)
    .map((s) => {
      const d = new Date(s.deadline!);
      d.setHours(0, 0, 0, 0);
      return { semester: s, days: Math.ceil((d.getTime() - today.getTime()) / 86_400_000) };
    });

  if (withDeadlines.length === 0) return null;

  const upcoming = withDeadlines.filter((x) => x.days >= 0).sort((a, b) => a.days - b.days);
  if (upcoming.length > 0) return upcoming[0];

  return withDeadlines.sort((a, b) => b.days - a.days)[0];
}

/**
 * A semester's identity, for storing which intake a student is applying to.
 *
 * `Semester` has no id of its own, and a name alone is not unique — a
 * university can list "Fall 2026" once for its English-taught programmes and
 * again for its Turkmen-taught ones. Pairing the name with the start date is
 * stable when an admin reorders the list, which an index would not be.
 */
export function semesterKey(s: Semester): string {
  return `${s.name}|${s.start_date}`;
}

export type ResolvedDeadline = { semester: Semester; days: number | null };

/**
 * The semester a row should show: the student's choice if they made one and it
 * still exists, otherwise the automatic nearest-deadline pick.
 *
 * `days` is null when the chosen semester has no published deadline — a student
 * may well target "Spring 2027" before its date is announced, and that is a
 * semester without a countdown rather than a semester without a choice.
 */
export function resolveSemester(
  semesters: Semester[],
  key: string | null,
): ResolvedDeadline | null {
  if (key) {
    const chosen = semesters.find((s) => semesterKey(s) === key);
    if (chosen) {
      return { semester: chosen, days: chosen.deadline ? daysUntil(chosen.deadline) : null };
    }
    // The chosen semester is gone — fall through to auto rather than showing
    // the student nothing.
  }

  return getNearestDeadline(semesters);
}

function daysUntil(deadline: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

export function deadlineBadgeCls(days: number): string {
  if (days < 0) return 'bg-muted text-muted-foreground';
  if (days <= 14) return 'bg-red-50 text-red-600';
  if (days <= 30) return 'bg-orange-50 text-orange-600';
  if (days <= 60) return 'bg-yellow-50 text-yellow-700';
  return 'bg-green-50 text-green-700';
}
