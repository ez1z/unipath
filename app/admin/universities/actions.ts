'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { CsvRowSchema } from '@/lib/data/university-types';
import type { UniversityInsert } from '@/lib/data/university-types';
import { SUPPORTED_LOCALES } from '@/lib/constants';
import { FormSchema } from '@/lib/data/university-schema';
import { slugify } from '@/lib/utils/slugify';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/admin/signin');
  const { data: adminRow } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .single();
  if (!adminRow) redirect('/admin/signin');
  return supabase;
}

function friendlyDbError(error: { code?: string; message: string }): string {
  if (error.code === '23505') {
    return 'A university with this English name already exists.';
  }
  return error.message;
}

function revalidateUniversityPaths() {
  for (const locale of SUPPORTED_LOCALES) {
    revalidatePath(`/${locale}/universities`);
    revalidatePath(`/${locale}`);
  }
}

export async function importUniversitiesAction(
  rawRows: Record<string, string>[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  const supabase = await requireAdmin();

  const parsed = z.array(CsvRowSchema).safeParse(rawRows);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const rowIdx = typeof issue.path[0] === 'number' ? issue.path[0] + 1 : '?';
    return { success: false, error: `Row ${rowIdx}, ${String(issue.path[1] ?? '')}: ${issue.message}` };
  }

  const rows: UniversityInsert[] = parsed.data.map((r) => ({
    name_en: r.name_en,
    name_ru: r.name_ru,
    name_tk: r.name_tk,
    slug: slugify(r.name_en),
    country: r.country,
    city: r.city,
    tuition_usd: r.tuition_usd,
    moe_approved: r.moe_approved,
    ranking_qs: r.ranking_qs,
    languages: r.languages,
    majors: r.majors,
    official_website: r.official_website,
    application_portal_url: r.application_portal_url,
    entrance_requirements: r.entrance_requirements,
  }));

  const { error } = await supabase
    .from('universities')
    .upsert(rows, { onConflict: 'name_en', ignoreDuplicates: false });

  if (error) return { success: false, error: friendlyDbError(error) };

  revalidateUniversityPaths();
  return { success: true, count: rows.length };
}

export async function deleteUniversityAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await requireAdmin();
  const { error } = await supabase.from('universities').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidateUniversityPaths();
  return { success: true };
}

export async function toggleMoeApprovedAction(
  id: string,
  currentValue: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from('universities')
    .update({ moe_approved: !currentValue })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidateUniversityPaths();
  return { success: true };
}

export async function createUniversityAction(
  formData: FormData
): Promise<{ error: string } | never> {
  const supabase = await requireAdmin();

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = FormSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${String(issue.path[0])}: ${issue.message}` };
  }

  const { error } = await supabase.from('universities').insert({
    ...parsed.data,
    slug: slugify(parsed.data.name_en),
  });
  if (error) return { error: friendlyDbError(error) };

  revalidateUniversityPaths();
  redirect('/admin/universities');
}

export async function updateUniversityAction(
  id: string,
  formData: FormData
): Promise<{ error: string } | never> {
  const supabase = await requireAdmin();

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = FormSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${String(issue.path[0])}: ${issue.message}` };
  }

  const { error } = await supabase
    .from('universities')
    .update({ ...parsed.data, slug: slugify(parsed.data.name_en) })
    .eq('id', id);
  if (error) return { error: friendlyDbError(error) };

  revalidateUniversityPaths();
  redirect('/admin/universities');
}
