import type { Scholarship, ScholarshipFilterParams } from './scholarship-types';

export function filterScholarships(
  scholarships: Scholarship[],
  params: ScholarshipFilterParams
): Scholarship[] {
  let result = scholarships;

  if (params.country) {
    result = result.filter((s) => s.country === params.country);
  }
  if (params.type) {
    result = result.filter((s) => s.type === params.type);
  }
  if (params.coverage) {
    result = result.filter((s) => s.coverage.includes(params.coverage!));
  }
  if (params.query) {
    const q = params.query.toLowerCase();
    result = result.filter(
      (s) =>
        s.name.en.toLowerCase().includes(q) ||
        s.name.ru.toLowerCase().includes(q) ||
        s.name.tk.toLowerCase().includes(q) ||
        s.country.toLowerCase().includes(q)
    );
  }

  return result;
}
