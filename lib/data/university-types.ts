import { z } from 'zod';

export type UniversityDbRow = {
  id: string;
  name_en: string;
  name_ru: string;
  name_tk: string;
  country: string;
  city: string;
  tuition_usd: string | number;
  moe_approved: boolean;
  ranking_qs: number | null;
  languages: string[];
  majors: string[];
  official_website: string;
  application_portal_url: string;
  entrance_requirements: Record<string, unknown>;
  created_at: string;
};

export type University = {
  id: string;
  name: { tk: string; ru: string; en: string };
  country: string;
  city: string;
  tuition_usd: number;
  moe_approved: boolean;
  ranking_qs: number | null;
  languages: string[];
  majors: string[];
  official_website: string;
  application_portal_url: string;
  entrance_requirements: Record<string, unknown>;
};

export function dbRowToUniversity(row: UniversityDbRow): University {
  return {
    id: row.id,
    name: { en: row.name_en, ru: row.name_ru, tk: row.name_tk },
    country: row.country,
    city: row.city,
    tuition_usd: Number(row.tuition_usd),
    moe_approved: row.moe_approved,
    ranking_qs: row.ranking_qs,
    languages: row.languages,
    majors: row.majors,
    official_website: row.official_website,
    application_portal_url: row.application_portal_url,
    entrance_requirements: row.entrance_requirements ?? {},
  };
}

export type FilterParams = {
  query?: string;
  country?: string;
  language?: string;
  major?: string;
  moeOnly?: boolean;
};

export const CsvRowSchema = z.object({
  name_en: z.string().min(1, 'name_en is required'),
  name_ru: z.string().min(1, 'name_ru is required'),
  name_tk: z.string().min(1, 'name_tk is required'),
  country: z.string().min(1, 'country is required'),
  city: z.string().min(1, 'city is required'),
  tuition_usd: z.string().transform((v) => {
    const n = Number(v);
    if (isNaN(n) || n < 0) throw new Error('must be a non-negative number');
    return n;
  }),
  moe_approved: z.string().transform((v) => {
    const lower = v.toLowerCase().trim();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    throw new Error('must be "true" or "false"');
  }),
  ranking_qs: z.string().optional().transform((v) => {
    if (!v || v.trim() === '') return null;
    const n = parseInt(v, 10);
    if (isNaN(n) || n <= 0) throw new Error('must be a positive integer or blank');
    return n;
  }),
  languages: z.string().transform((v) =>
    v.split('|').map((s) => s.trim()).filter(Boolean)
  ),
  majors: z.string().transform((v) =>
    v.split('|').map((s) => s.trim()).filter(Boolean)
  ),
  official_website: z.string().url('must be a valid URL'),
  application_portal_url: z.string().url('must be a valid URL'),
  entrance_requirements: z.string().optional().transform((v) => {
    if (!v || v.trim() === '') return {};
    try {
      return JSON.parse(v) as Record<string, unknown>;
    } catch {
      throw new Error('must be valid JSON or blank');
    }
  }),
});

export type CsvRow = z.infer<typeof CsvRowSchema>;

export type UniversityInsert = {
  name_en: string;
  name_ru: string;
  name_tk: string;
  country: string;
  city: string;
  tuition_usd: number;
  moe_approved: boolean;
  ranking_qs: number | null;
  languages: string[];
  majors: string[];
  official_website: string;
  application_portal_url: string;
  entrance_requirements: Record<string, unknown>;
};
