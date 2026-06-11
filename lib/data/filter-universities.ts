import type { University, FilterParams } from './university-types';
import { getNextDeadline } from '@/lib/types/semester';

export function filterUniversities(universities: University[], params: FilterParams): University[] {
  let result = universities;

  if (params.moeOnly) {
    result = result.filter((u) => u.moe_approved);
  }
  if (params.country) {
    result = result.filter((u) => u.country === params.country);
  }
  if (params.language) {
    result = result.filter((u) => u.languages.includes(params.language!));
  }
  if (params.major) {
    result = result.filter((u) =>
      u.majors.some((m) => m.toLowerCase().includes(params.major!.toLowerCase()))
    );
  }
  if (params.rankedOnly) {
    result = result.filter((u) => u.ranking_qs !== null);
  }
  if (params.maxTuition !== undefined) {
    result = result.filter((u) => u.tuition_usd <= params.maxTuition!);
  }
  if (params.deadlineStatus === 'upcoming') {
    result = result.filter((u) => getNextDeadline(u.semesters) !== null);
  } else if (params.deadlineStatus === 'passed') {
    result = result.filter(
      (u) =>
        getNextDeadline(u.semesters) === null &&
        u.semesters.some((s) => s.deadline !== null),
    );
  }
  if (params.query) {
    const q = params.query.toLowerCase();
    result = result.filter(
      (u) =>
        u.name.en.toLowerCase().includes(q) ||
        u.name.ru.toLowerCase().includes(q) ||
        u.name.tk.toLowerCase().includes(q) ||
        u.city.toLowerCase().includes(q) ||
        u.country.toLowerCase().includes(q)
    );
  }

  return result;
}
