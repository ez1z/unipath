import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { CATALOG_REVALIDATE_SECONDS, SCHOLARSHIPS_TAG } from './cache-tags';
import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public';
import type { ScholarshipDbRow } from './scholarship-types';
import { dbRowToScholarship } from './scholarship-types';

export type { Scholarship } from './scholarship-types';
export type { ScholarshipFilterParams } from './scholarship-types';

// Public reads use the cookie-less client so the pages that call them can be
// cached (see lib/supabase/public.ts). `cache` makes repeat calls in one render
// share a single fetch. The full list (~0.7 MB) is also kept in Next's Data
// Cache so force-dynamic pages don't fetch it from Supabase on every visit;
// see lib/data/universities.ts for why.
const fetchActiveScholarships = unstable_cache(
  async (): Promise<ScholarshipDbRow[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('scholarships')
      .select('*')
      .eq('is_active', true)
      .order('country', { ascending: true })
      .order('name_en', { ascending: true });
    if (error) throw new Error(`Failed to fetch scholarships: ${error.message}`);
    return data as ScholarshipDbRow[];
  },
  ['scholarships-catalog'],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [SCHOLARSHIPS_TAG] },
);

const queryAll = cache(async () => {
  const rows = await fetchActiveScholarships();
  return rows.map(dbRowToScholarship);
});

export async function getAll() {
  return queryAll();
}

export async function getById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('scholarships')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch scholarship: ${error.message}`);
  if (!data) return undefined;
  return dbRowToScholarship(data as ScholarshipDbRow);
}

// Like universities, detail lookups read the cached catalog first and only
// query the database for a slug it doesn't know yet.
export async function getBySlug(slug: string) {
  const cached = (await queryAll()).find((s) => s.slug === slug);
  return cached ?? getBySlugDirect(slug);
}

/** One-row lookup without the catalog, for pages that render on every request. */
export async function getBySlugDirect(slug: string) {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('scholarships')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch scholarship: ${error.message}`);
  if (!data) return undefined;
  return dbRowToScholarship(data as ScholarshipDbRow);
}

// Scholarships linked to the university, then nationwide ones for its country,
// each group by name (the catalog is ordered by country, then name).
export async function getByUniversity(universityId: string, country: string) {
  const all = await queryAll();
  return [
    ...all.filter((s) => s.university_id === universityId),
    ...all.filter((s) => s.university_id === null && s.country === country),
  ];
}

// Returns the ids of universities that have at least one scholarship available
// to their students — either a scholarship linked directly to the university,
// or a nationwide scholarship (university_id null) for the university's country.
export async function getScholarshipEligibleUniversityIds(
  universities: { id: string; country: string }[],
): Promise<string[]> {
  const all = await queryAll();
  const linkedUniIds = new Set(
    all.filter((s) => s.university_id !== null).map((s) => s.university_id as string),
  );
  const nationwideCountries = new Set(
    all.filter((s) => s.university_id === null).map((s) => s.country),
  );
  return universities
    .filter((u) => linkedUniIds.has(u.id) || nationwideCountries.has(u.country))
    .map((u) => u.id);
}

export async function getUniqueCountries(): Promise<string[]> {
  const all = await queryAll();
  return [...new Set(all.map((s) => s.country))].sort();
}

export async function getUniqueTypes(): Promise<string[]> {
  const all = await queryAll();
  return [...new Set(all.map((s) => s.type))].sort();
}
