export type Semester = {
  name: string;
  start_date: string; // YYYY-MM-DD
  deadline: string | null; // YYYY-MM-DD or null
  language?: string | null; // null = applies to all languages
  major?: string | null;    // null = applies to all majors
};

function toNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t;
}

export function parseSemestersJson(raw: unknown): Semester[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s) =>
        typeof s === 'object' &&
        s !== null &&
        typeof (s as Record<string, unknown>).name === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test((s as Record<string, unknown>).start_date as string) &&
        ((s as Record<string, unknown>).deadline === null ||
          /^\d{4}-\d{2}-\d{2}$/.test((s as Record<string, unknown>).deadline as string))
    )
    .map((s) => {
      const r = s as Record<string, unknown>;
      return {
        name: r.name as string,
        start_date: r.start_date as string,
        deadline: typeof r.deadline === 'string' ? r.deadline : null,
        language: toNullableString(r.language),
        major: toNullableString(r.major),
      };
    });
}

export function getNextDeadline(semesters: Semester[]): string | null {
  const today = new Date().toISOString().split('T')[0];
  const futures = semesters
    .filter((s) => s.deadline !== null && s.deadline! >= today)
    .map((s) => s.deadline!);
  if (futures.length === 0) return null;
  return futures.reduce((a, b) => (a < b ? a : b));
}

export function parseSemestersCsv(raw: string): Semester[] {
  if (!raw.trim()) return [];
  return raw
    .split('|')
    .map((seg) => {
      const [name, start_date, deadline] = seg.trim().split(':');
      return {
        name: name?.trim() ?? '',
        start_date: start_date?.trim() ?? '',
        deadline: deadline?.trim() || null,
      };
    })
    .filter(
      (s) => s.name && /^\d{4}-\d{2}-\d{2}$/.test(s.start_date)
    );
}
