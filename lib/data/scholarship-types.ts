import { z } from 'zod';
import type { Semester } from '@/lib/types/semester';
import { parseSemestersJson, parseSemestersCsv } from '@/lib/types/semester';
export type { Semester };

export type ScholarshipType = 'government' | 'merit' | 'need-based' | 'partial';
export type CoverageItem = 'tuition' | 'accommodation' | 'flights' | 'stipend' | 'health';

export const COVERAGE_ITEMS: CoverageItem[] = ['tuition', 'accommodation', 'flights', 'stipend', 'health'];

export type ScholarshipDbRow = {
  id: string;
  slug: string;
  university_id: string | null;
  country: string;
  name_en: string;
  name_ru: string;
  name_tk: string;
  type: ScholarshipType;
  coverage: string[];
  amount_usd: string | number | null;
  deadline_text: string | null;
  semesters: unknown;
  description_en: string;
  description_ru: string;
  description_tk: string;
  application_url: string;
  is_active: boolean;
  created_at: string;
};

export type Scholarship = {
  id: string;
  slug: string;
  university_id: string | null;
  country: string;
  name: { tk: string; ru: string; en: string };
  type: ScholarshipType;
  coverage: string[];
  amount_usd: number | null;
  deadline_text: string | null;
  semesters: Semester[];
  description: { tk: string; ru: string; en: string };
  application_url: string;
};

export function dbRowToScholarship(row: ScholarshipDbRow): Scholarship {
  return {
    id: row.id,
    slug: row.slug,
    university_id: row.university_id,
    country: row.country,
    name: { en: row.name_en, ru: row.name_ru, tk: row.name_tk },
    type: row.type,
    coverage: row.coverage,
    amount_usd: row.amount_usd !== null ? Number(row.amount_usd) : null,
    deadline_text: row.deadline_text,
    semesters: parseSemestersJson(row.semesters),
    description: { en: row.description_en, ru: row.description_ru, tk: row.description_tk },
    application_url: row.application_url,
  };
}

export type ScholarshipFilterParams = {
  query?: string;
  country?: string;
  type?: string;
  coverage?: string;
};

export const ScholarshipCsvRowSchema = z.object({
  name_en: z.string().min(1, 'name_en is required'),
  name_ru: z.string().min(1, 'name_ru is required'),
  name_tk: z.string().min(1, 'name_tk is required'),
  country: z.string().min(1, 'country is required'),
  university_name_en: z.string().optional(),
  type: z.enum(['government', 'merit', 'need-based', 'partial'], {
    message: 'must be government, merit, need-based, or partial',
  }),
  coverage: z.string().optional().transform((v) =>
    v ? v.split('|').map((s) => s.trim()).filter(Boolean) : []
  ),
  amount_usd: z.string().optional().transform((v, ctx) => {
    if (!v || v.trim() === '') return null;
    const n = Number(v);
    if (isNaN(n) || n <= 0) {
      ctx.addIssue({ code: 'custom', message: 'must be a positive number or blank' });
      return z.NEVER;
    }
    return n;
  }),
  deadline_text: z.string().optional().transform((v) => v?.trim() || null),
  semesters: z.string().optional().transform((v) =>
    v ? parseSemestersCsv(v) : []
  ),
  description_en: z.string().default(''),
  description_ru: z.string().default(''),
  description_tk: z.string().default(''),
  application_url: z.string().optional().transform((v) => v?.trim() || ''),
});

export type ScholarshipCsvRow = z.infer<typeof ScholarshipCsvRowSchema>;

export type ScholarshipInsert = {
  slug: string;
  university_id: string | null;
  country: string;
  name_en: string;
  name_ru: string;
  name_tk: string;
  type: ScholarshipType;
  coverage: string[];
  amount_usd: number | null;
  deadline_text: string | null;
  semesters: Semester[];
  description_en: string;
  description_ru: string;
  description_tk: string;
  application_url: string;
};
