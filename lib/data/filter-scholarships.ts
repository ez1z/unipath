import type { Scholarship, ScholarshipFilterParams } from './scholarship-types';
import { getNextDeadline } from '@/lib/types/semester';

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
  if (params.hasAmount || params.minAmount !== undefined) {
    result = result.filter((s) => s.amount_usd !== null);
  }
  if (params.minAmount !== undefined) {
    result = result.filter((s) => s.amount_usd! >= params.minAmount!);
  }
  if (params.deadlineStatus === 'upcoming') {
    result = result.filter((s) => getNextDeadline(s.semesters) !== null);
  } else if (params.deadlineStatus === 'passed') {
    result = result.filter(
      (s) =>
        getNextDeadline(s.semesters) === null &&
        s.semesters.some((sem) => sem.deadline !== null),
    );
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
