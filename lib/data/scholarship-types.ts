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
  amount_usd_max: string | number | null;
  deadline_text: string | null;
  semesters: unknown;
  requirements: Record<string, unknown>;
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
  amount_usd_max: number | null;
  deadline_text: string | null;
  semesters: Semester[];
  requirements: Record<string, unknown>;
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
    amount_usd_max: row.amount_usd_max != null ? Number(row.amount_usd_max) : null,
    deadline_text: row.deadline_text,
    semesters: parseSemestersJson(row.semesters),
    requirements: row.requirements ?? {},
    description: { en: row.description_en, ru: row.description_ru, tk: row.description_tk },
    application_url: row.application_url,
  };
}

export type ScholarshipSortBy = 'name' | 'amount_desc' | 'amount_asc' | 'deadline_asc' | 'deadline_desc';

export type ScholarshipFilterParams = {
  query?: string;
  country?: string;
  type?: string;
  coverage?: string;
  hasAmount?: boolean;
  minAmount?: number;
  deadlineStatus?: 'upcoming' | 'passed';
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
  amount_usd_max: z.string().optional().transform((v, ctx) => {
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
}).refine((r) => r.amount_usd_max == null || r.amount_usd == null || r.amount_usd_max >= r.amount_usd, {
  message: 'amount_usd_max must be ≥ amount_usd',
  path: ['amount_usd_max'],
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
  amount_usd_max: number | null;
  deadline_text: string | null;
  semesters: Semester[];
  requirements: Record<string, unknown>;
  description_en: string;
  description_ru: string;
  description_tk: string;
  application_url: string;
};
