import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase/public';
import type { UniversityDbRow } from './university-types';
import { dbRowToUniversity } from './university-types';

export type { University } from './university-types';
export type { FilterParams } from './university-types';

// Public reads use the cookie-less client so the pages that call them can be
// cached (see lib/supabase/public.ts). `cache` makes repeat calls in one render
// share a single fetch: the list page used to load all universities four times.
const queryAll = cache(async () => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('universities')
    .select('*')
    .order('name_en', { ascending: true });
  if (error) throw new Error(`Failed to fetch universities: ${error.message}`);
  return (data as UniversityDbRow[]).map(dbRowToUniversity);
});

export async function getAll() {
  return queryAll();
}

export async function getById(id: string) {
  const supabase = createPublicClient();
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
  const supabase = createPublicClient();
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
