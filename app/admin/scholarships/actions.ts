'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin, logAction } from '@/lib/admin/auth';
import { COVERAGE_ITEMS, ScholarshipCsvRowSchema } from '@/lib/data/scholarship-types';
import type { ScholarshipInsert } from '@/lib/data/scholarship-types';
import { ScholarshipFormSchema } from '@/lib/data/scholarship-schema';
import { SUPPORTED_LOCALES } from '@/lib/constants';
import { slugify } from '@/lib/utils/slugify';
type SupabaseClient = Awaited<ReturnType<typeof requireAdmin>>['supabase'];

async function generateScholarshipSlug(
  supabase: SupabaseClient,
  nameEn: string,
  country: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(`${nameEn}-${country}`);
  let candidate = base;
  let suffix = 2;
  while (true) {
    let query = supabase.from('scholarships').select('id').eq('slug', candidate);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix++;
  }
}

function revalidateScholarshipPaths() {
  for (const locale of SUPPORTED_LOCALES) {
    revalidatePath(`/${locale}/scholarships`);
  }
}

export async function createScholarshipAction(
  formData: FormData
): Promise<{ error: string } | never> {
  const { supabase, user } = await requireAdmin();

  const raw: Record<string, string> = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, String(v)])
  );

  const selectedCoverage = COVERAGE_ITEMS.filter((item) => formData.get(`coverage_${item}`) === 'on');
  raw.coverage = selectedCoverage.join(',');

  const parsed = ScholarshipFormSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${String(issue.path[0])}: ${issue.message}` };
  }

  const slug = await generateScholarshipSlug(supabase, parsed.data.name_en, parsed.data.country);

  const { error } = await supabase.from('scholarships').insert({
    slug,
    university_id: parsed.data.university_id,
    country: parsed.data.country,
    name_en: parsed.data.name_en,
    name_ru: parsed.data.name_ru,
    name_tk: parsed.data.name_tk,
    type: parsed.data.type,
    coverage: parsed.data.coverage,
    amount_usd: parsed.data.amount_usd,
    amount_usd_max: parsed.data.amount_usd_max,
    acceptance_rate_min: parsed.data.acceptance_rate_min,
    acceptance_rate_max: parsed.data.acceptance_rate_max,
    deadline_text: parsed.data.deadline_text,
    semesters: parsed.data.semesters,
    requirements: parsed.data.requirements,
    description_en: parsed.data.description_en,
    description_ru: parsed.data.description_ru,
    description_tk: parsed.data.description_tk,
    application_url: parsed.data.application_url,
  });

  if (error) return { error: error.message };

  revalidateScholarshipPaths();
  await logAction({
    adminUserId: user.id,
    adminEmail: user.email!,
    action: 'create_scholarship',
    entityType: 'scholarship',
    entityName: parsed.data.name_en,
  });
  redirect('/admin/scholarships');
}

export async function updateScholarshipAction(
  id: string,
  formData: FormData
): Promise<{ error: string } | never> {
  const { supabase, user } = await requireAdmin();

  const raw: Record<string, string> = Object.fromEntries(
    [...formData.entries()].map(([k, v]) => [k, String(v)])
  );

  const selectedCoverage = COVERAGE_ITEMS.filter((item) => formData.get(`coverage_${item}`) === 'on');
  raw.coverage = selectedCoverage.join(',');

  const parsed = ScholarshipFormSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${String(issue.path[0])}: ${issue.message}` };
  }

  const slug = await generateScholarshipSlug(supabase, parsed.data.name_en, parsed.data.country, id);

  const { error } = await supabase
    .from('scholarships')
    .update({
      slug,
      university_id: parsed.data.university_id,
      country: parsed.data.country,
      name_en: parsed.data.name_en,
      name_ru: parsed.data.name_ru,
      name_tk: parsed.data.name_tk,
      type: parsed.data.type,
      coverage: parsed.data.coverage,
      amount_usd: parsed.data.amount_usd,
      amount_usd_max: parsed.data.amount_usd_max,
      acceptance_rate_min: parsed.data.acceptance_rate_min,
      acceptance_rate_max: parsed.data.acceptance_rate_max,
      deadline_text: parsed.data.deadline_text,
      semesters: parsed.data.semesters,
      requirements: parsed.data.requirements,
      description_en: parsed.data.description_en,
      description_ru: parsed.data.description_ru,
      description_tk: parsed.data.description_tk,
      application_url: parsed.data.application_url,
    })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidateScholarshipPaths();
  await logAction({
    adminUserId: user.id,
    adminEmail: user.email!,
    action: 'update_scholarship',
    entityType: 'scholarship',
    entityId: id,
    entityName: parsed.data.name_en,
  });
  redirect('/admin/scholarships');
}

export async function deleteScholarshipAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await requireAdmin();
  const { error } = await supabase.from('scholarships').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  revalidateScholarshipPaths();
  await logAction({
    adminUserId: user.id,
    adminEmail: user.email!,
    action: 'delete_scholarship',
    entityType: 'scholarship',
    entityId: id,
  });
  return { success: true };
}

export async function bulkDeleteScholarshipsAction(
  ids: string[]
): Promise<{ success: boolean; error?: string }> {
  const { supabase, user } = await requireAdmin();
  const { error } = await supabase.from('scholarships').delete().in('id', ids);
  if (error) return { success: false, error: error.message };
  revalidateScholarshipPaths();
  await logAction({
    adminUserId: user.id,
    adminEmail: user.email!,
    action: 'bulk_delete_scholarships',
    entityType: 'scholarship',
    details: { count: ids.length },
  });
  return { success: true };
}

export async function importScholarshipsAction(
  rawRows: Record<string, string>[],
): Promise<{ success: boolean; count?: number; error?: string }> {
  const { supabase, user } = await requireAdmin();

  const parsed = z.array(ScholarshipCsvRowSchema).safeParse(rawRows);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const rowIdx = typeof issue.path[0] === 'number' ? issue.path[0] + 1 : '?';
    return { success: false, error: `Row ${rowIdx}, ${String(issue.path[1] ?? '')}: ${issue.message}` };
  }

  // Resolve university_name_en → university_id in a single query
  const universityNames = [
    ...new Set(
      parsed.data
        .map((r) => r.university_name_en?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  ];
  const universityMap = new Map<string, string>();
  if (universityNames.length > 0) {
    const { data: unis } = await supabase
      .from('universities')
      .select('id, name_en')
      .in('name_en', universityNames);
    for (const u of unis ?? []) {
      universityMap.set(u.name_en as string, u.id as string);
    }
  }

  const rows: ScholarshipInsert[] = parsed.data.map((r) => ({
    slug: slugify(`${r.name_en}-${r.country}`),
    university_id: r.university_name_en?.trim()
      ? (universityMap.get(r.university_name_en.trim()) ?? null)
      : null,
    country: r.country,
    name_en: r.name_en,
    name_ru: r.name_ru,
    name_tk: r.name_tk,
    type: r.type,
    coverage: r.coverage,
    amount_usd: r.amount_usd,
    amount_usd_max: r.amount_usd_max,
    acceptance_rate_min: r.acceptance_rate_min,
    acceptance_rate_max: r.acceptance_rate_max,
    deadline_text: r.deadline_text,
    semesters: r.semesters,
    requirements: {},
    description_en: r.description_en,
    description_ru: r.description_ru,
    description_tk: r.description_tk,
    application_url: r.application_url ?? '',
  }));

  const { error } = await supabase
    .from('scholarships')
    .upsert(rows, { onConflict: 'slug', ignoreDuplicates: false });

  if (error) return { success: false, error: error.message };

  revalidateScholarshipPaths();
  await logAction({
    adminUserId: user.id,
    adminEmail: user.email!,
    action: 'import_scholarships',
    entityType: 'scholarship',
    details: { count: rows.length },
  });
  return { success: true, count: rows.length };
}
