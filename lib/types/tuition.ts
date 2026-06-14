export type TuitionOption = {
  // Each dimension is optional: null means "applies regardless of this variable".
  semester: string | null;
  language: string | null;
  major: string | null;
  amount_usd: number;
  note: string | null;
};

function toNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed;
}

export function parseTuitionOptionsJson(raw: unknown): TuitionOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o): o is Record<string, unknown> => typeof o === 'object' && o !== null)
    .map((o) => ({
      semester: toNullableString(o.semester),
      language: toNullableString(o.language),
      major: toNullableString(o.major),
      amount_usd: Number(o.amount_usd),
      note: toNullableString(o.note),
    }))
    .filter((o) => Number.isFinite(o.amount_usd) && o.amount_usd >= 0);
}

// CSV format: pipe-separated records, each with colon-separated fields in the
// order semester:language:major:amount_usd:note. Empty fields are allowed, e.g.
// "Fall:English:Engineering:5000|::Medicine:8000".
export function parseTuitionOptionsCsv(raw: string): TuitionOption[] {
  if (!raw.trim()) return [];
  return raw
    .split('|')
    .map((seg) => {
      const [semester, language, major, amount, note] = seg.split(':');
      return {
        semester: toNullableString(semester),
        language: toNullableString(language),
        major: toNullableString(major),
        amount_usd: Number((amount ?? '').trim()),
        note: toNullableString(note),
      };
    })
    .filter((o) => Number.isFinite(o.amount_usd) && o.amount_usd >= 0);
}
