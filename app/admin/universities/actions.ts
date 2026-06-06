'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { CsvRowSchema } from '@/lib/data/university-types';
import type { UniversityInsert } from '@/lib/data/university-types';
import { SUPPORTED_LOCALES } from '@/lib/constants';

const FormSchema = z.object({
  name_en: z.string().min(1, 'English name is required'),
  name_ru: z.string().min(1, 'Russian name is required'),
  name_tk: z.string().min(1, 'Turkmen name is required'),
  country: z.string().min(1, 'Country is required'),
  city: z.string().min(1, 'City is required'),
  tuition_usd: z.coerce.number().nonnegative('Must be ≥ 0'),
  moe_approved: z.string().optional().transform((v) => v === 'true'),
  ranking_qs: z.string().optional().transform((v) => {
    if (!v || v.trim() === '') return null;
    const n = parseInt(v, 10);
    return isNaN(n) || n <= 0 ? null : n;
  }),
  languages: z.string().min(1, 'At least one language is required').transform((v) =>
    v.split('|').map((s) => s.trim()).filter(Boolean)
  ),
  majors: z.string().min(1, 'At least one major is required').transform((v) =>
    v.split('|').map((s) => s.trim()).filter(Boolean)
  ),
  official_website: z.string().url('Must be a valid URL (https://...)'),
  application_portal_url: z.string().url('Must be a valid URL (https://...)'),
  entrance_requirements: z.string().optional().transform((v) => {
    if (!v || v.trim() === '') return {};
    try {
      return JSON.parse(v) as Record<string, unknown>;
    } catch {
      throw new Error('Entrance requirements must be valid JSON');
    }
  }),
});

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

  const { error } = await supabase.from('universities').insert(parsed.data);
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

  const { error } = await supabase.from('universities').update(parsed.data).eq('id', id);
  if (error) return { error: friendlyDbError(error) };

  revalidateUniversityPaths();
  redirect('/admin/universities');
}
