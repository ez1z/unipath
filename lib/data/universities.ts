import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { CATALOG_REVALIDATE_SECONDS, UNIVERSITIES_TAG } from './cache-tags';
import { createPublicClient } from '@/lib/supabase/public';
import type { UniversityDbRow } from './university-types';
import { dbRowToUniversity } from './university-types';

export type { University } from './university-types';
export type { FilterParams } from './university-types';

// Public reads use the cookie-less client so the pages that call them can be
// cached (see lib/supabase/public.ts). `cache` makes repeat calls in one render
// share a single fetch: the list page used to load all universities four times.
//
// The full catalog (~2 MB of JSON) is also kept in Next's Data Cache, shared by
// every request and server instance, so the force-dynamic pages (list, compare,
// tracker, scholarships, MoE list) and the chat route no longer pull it from
// Supabase on every visit. That fetch was most of the project's database egress.
// Admin edits refresh it at once through the tag; other writes (the daily
// research job) show up within CATALOG_REVALIDATE_SECONDS.
//
// Rows come in pages because PostgREST returns at most 1000 rows per request
// (the old single query silently dropped everything after the 1000th
// university), and because the Data Cache won't store a single entry over 2 MB.
const PAGE_SIZE = 400;
const MAX_PAGES = 25;

const fetchUniversityPage = unstable_cache(
  async (from: number): Promise<UniversityDbRow[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('universities')
      .select('*')
      .order('name_en', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to fetch universities: ${error.message}`);
    return data as UniversityDbRow[];
  },
  ['universities-catalog-page'],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [UNIVERSITIES_TAG] },
);

const queryAll = cache(async () => {
  const rows: UniversityDbRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await fetchUniversityPage(page * PAGE_SIZE);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows.map(dbRowToUniversity);
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
