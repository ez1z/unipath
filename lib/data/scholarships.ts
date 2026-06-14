import { createClient } from '@/lib/supabase/server';
import type { ScholarshipDbRow } from './scholarship-types';
import { dbRowToScholarship } from './scholarship-types';

export type { Scholarship } from './scholarship-types';
export type { ScholarshipFilterParams } from './scholarship-types';

async function queryAll() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('scholarships')
    .select('*')
    .eq('is_active', true)
    .order('country', { ascending: true })
    .order('name_en', { ascending: true });
  if (error) throw new Error(`Failed to fetch scholarships: ${error.message}`);
  return (data as ScholarshipDbRow[]).map(dbRowToScholarship);
}

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

export async function getBySlug(slug: string) {
  const supabase = await createClient();
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

export async function getByUniversity(universityId: string, country: string) {
  const supabase = await createClient();
  const [uniResult, countryResult] = await Promise.all([
    supabase
      .from('scholarships')
      .select('*')
      .eq('university_id', universityId)
      .eq('is_active', true)
      .order('name_en'),
    supabase
      .from('scholarships')
      .select('*')
      .is('university_id', null)
      .eq('country', country)
      .eq('is_active', true)
      .order('name_en'),
  ]);
  if (uniResult.error) throw new Error(uniResult.error.message);
  if (countryResult.error) throw new Error(countryResult.error.message);
  const all = [
    ...(uniResult.data as ScholarshipDbRow[]),
    ...(countryResult.data as ScholarshipDbRow[]),
  ];
  return all.map(dbRowToScholarship);
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
