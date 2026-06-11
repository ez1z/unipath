import { z } from 'zod';
import type { Semester } from '@/lib/types/semester';
import { parseSemestersJson, parseSemestersCsv } from '@/lib/types/semester';
export type { Semester };

export type UniversityDbRow = {
  id: string;
  slug: string;
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
  semesters: unknown;
  created_at: string;
};

export type University = {
  id: string;
  slug: string;
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
  semesters: Semester[];
};

export function dbRowToUniversity(row: UniversityDbRow): University {
  return {
    id: row.id,
    slug: row.slug,
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
    semesters: parseSemestersJson(row.semesters),
  };
}

export type UniversitySortBy = 'name' | 'ranking' | 'tuition_asc' | 'tuition_desc' | 'deadline_asc' | 'deadline_desc';

export type FilterParams = {
  query?: string;
  country?: string;
  language?: string;
  major?: string;
  moeOnly?: boolean;
  rankedOnly?: boolean;
  maxTuition?: number;
  deadlineStatus?: 'upcoming' | 'passed';
};

export const CsvRowSchema = z.object({
  name_en: z.string().min(1, 'name_en is required'),
  name_ru: z.string().min(1, 'name_ru is required'),
  name_tk: z.string().min(1, 'name_tk is required'),
  country: z.string().min(1, 'country is required'),
  city: z.string().min(1, 'city is required'),
  tuition_usd: z.string().transform((v, ctx) => {
    const n = Number(v);
    if (isNaN(n) || n < 0) {
      ctx.addIssue({ code: 'custom', message: 'must be a non-negative number' });
      return z.NEVER;
    }
    return n;
  }),
  moe_approved: z.string().transform((v, ctx) => {
    const lower = v.toLowerCase().trim();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    ctx.addIssue({ code: 'custom', message: 'must be "true" or "false"' });
    return z.NEVER;
  }),
  ranking_qs: z.string().optional().transform((v, ctx) => {
    if (!v || v.trim() === '') return null;
    const n = parseInt(v, 10);
    if (isNaN(n) || n <= 0) {
      ctx.addIssue({ code: 'custom', message: 'must be a positive integer or blank' });
      return z.NEVER;
    }
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
  entrance_requirements: z.string().optional().transform((v, ctx) => {
    if (!v || v.trim() === '') return {};
    try {
      return JSON.parse(v) as Record<string, unknown>;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'must be valid JSON or blank' });
      return z.NEVER;
    }
  }),
  semesters: z.string().default('').transform((v) =>
    v ? parseSemestersCsv(v) : []
  ),
});

export type CsvRow = z.infer<typeof CsvRowSchema>;

export type UniversityInsert = {
  name_en: string;
  name_ru: string;
  name_tk: string;
  slug: string;
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
  semesters: Semester[];
};
