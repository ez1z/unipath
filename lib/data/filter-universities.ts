import type { University, FilterParams } from './university-types';

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
