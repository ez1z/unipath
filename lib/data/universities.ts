import { z } from 'zod';
import rawData from '@/data/universities.json';

const EntranceRequirementsSchema = z.record(z.string(), z.unknown());

const UniversitySchema = z.object({
  id: z.string(),
  name: z.object({ tk: z.string(), ru: z.string(), en: z.string() }),
  country: z.string(),
  city: z.string(),
  tuition_usd: z.number().nonnegative(),
  moe_approved: z.boolean(),
  ranking_qs: z.number().int().positive().nullable().optional(),
  languages: z.array(z.string()),
  majors: z.array(z.string()),
  official_website: z.string().url(),
  application_portal_url: z.string().url(),
  entrance_requirements: EntranceRequirementsSchema,
});

export type University = z.infer<typeof UniversitySchema>;

const parsed = z.array(UniversitySchema).safeParse(rawData);
if (!parsed.success) {
  throw new Error(`Invalid universities.json:\n${parsed.error.toString()}`);
}

const universities: University[] = parsed.data;

export function getAll(): University[] {
  return universities;
}

export function getById(id: string): University | undefined {
  return universities.find((u) => u.id === id);
}

export function getAllIds(): string[] {
  return universities.map((u) => u.id);
}

export type FilterParams = {
  query?: string;
  country?: string;
  language?: string;
  major?: string;
  moeOnly?: boolean;
};

export function filterUniversities(params: FilterParams): University[] {
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

export function getUniqueCountries(): string[] {
  return [...new Set(universities.map((u) => u.country))].sort();
}

export function getUniqueLanguages(): string[] {
  return [...new Set(universities.flatMap((u) => u.languages))].sort();
}

export function getUniqueMajors(): string[] {
  return [...new Set(universities.flatMap((u) => u.majors))].sort();
}
