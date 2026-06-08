export type Semester = {
  name: string;
  start_date: string; // YYYY-MM-DD
  deadline: string | null; // YYYY-MM-DD or null
};

export function parseSemestersJson(raw: unknown): Semester[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is Semester =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as Semester).name === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test((s as Semester).start_date) &&
      ((s as Semester).deadline === null ||
        /^\d{4}-\d{2}-\d{2}$/.test((s as Semester).deadline as string))
  );
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
