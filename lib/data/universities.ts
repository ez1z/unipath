import { createClient } from '@/lib/supabase/server';
import type { UniversityDbRow } from './university-types';
import { dbRowToUniversity } from './university-types';

export type { University } from './university-types';
export type { FilterParams } from './university-types';

async function queryAll() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('universities')
    .select('*')
    .order('name_en', { ascending: true });
  if (error) throw new Error(`Failed to fetch universities: ${error.message}`);
  return (data as UniversityDbRow[]).map(dbRowToUniversity);
}

export async function getAll() {
  return queryAll();
}

export async function getById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('universities')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch university: ${error.message}`);
  if (!data) return undefined;
  return dbRowToUniversity(data as UniversityDbRow);
}

export async function getBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('universities')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch university: ${error.message}`);
  if (!data) return undefined;
  return dbRowToUniversity(data as UniversityDbRow);
}

export async function getUniqueCountries(): Promise<string[]> {
  const all = await queryAll();
  return [...new Set(all.map((u) => u.country))].sort();
}

export async function getUniqueLanguages(): Promise<string[]> {
  const all = await queryAll();
  return [...new Set(all.flatMap((u) => u.languages))].sort();
}

export async function getUniqueMajors(): Promise<string[]> {
  const all = await queryAll();
  return [...new Set(all.flatMap((u) => u.majors))].sort();
}
