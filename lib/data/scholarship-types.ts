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
